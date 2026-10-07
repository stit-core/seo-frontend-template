import { type APIRequestContext, expect, test } from '@playwright/test'
import { scriptViolations } from '../../scripts/lib/site-policy.mjs'
import { localePath, SUPPORTED_LOCALES } from '../../src/shared/i18n/locale.ts'
import { cspProblems, edgeHeadersIn, originOf } from '../site'

const MESSAGE = 'Нужен сайт с блогом, формой заявки и картой сайта. Бюджет обсудим.'

// Адрес уникален на тест: приёмник общий, а спеки идут параллельно. Адрес на fail- приёмник
// отвергает — так проверяется отказ канала.
const address = (label: string) =>
  `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`

const form = (email: string, extra: Record<string, string> = {}) => ({
  name: 'Мария',
  email,
  message: MESSAGE,
  consent: '1',
  locale: 'ru',
  ...extra,
})

const delivered = async (request: APIRequestContext) =>
  (await (await request.get(`${originOf('stub')}/received`)).json()) as string[]

// Отказ до разбора заявки: короткий текст вне кеша и индекса.
function expectRefusal(response: { headers: () => Record<string, string> }) {
  expect(response.headers()['cache-control']).toBe('private, no-store')
  expect(response.headers()['x-robots-tag']).toBe('noindex')
}

test.describe('обработчик формы /api/contact: HTTP-контракт на prod-сервере', () => {
  test('заявка — PRG 303 на подтверждение своей локали и доставка в канал', async ({
    request,
    baseURL,
  }) => {
    for (const locale of SUPPORTED_LOCALES) {
      const email = address(`prg-${locale}`)
      const response = await request.post('/api/contact', {
        form: form(email, { locale }),
        headers: { origin: baseURL ?? '' },
        maxRedirects: 0,
      })
      expect(response.status(), locale).toBe(303)
      expect(response.headers().location, locale).toBe(localePath(locale, '/contacts/spasibo'))
      await expect.poll(() => delivered(request)).toContain(email)
    }
  })

  test('ловушка заполнена: ответ как у человека, доставки нет', async ({ request, baseURL }) => {
    const email = address('honeypot')
    const response = await request.post('/api/contact', {
      form: form(email, { company: 'ООО Спам' }),
      headers: { origin: baseURL ?? '' },
      maxRedirects: 0,
    })
    expect(response.status()).toBe(303)
    expect(response.headers().location).toBe('/contacts/spasibo')
    // Пауза даёт доставке шанс произойти — её не должно быть.
    await new Promise((done) => setTimeout(done, 300))
    expect(await delivered(request)).not.toContain(email)
  })

  test('ошибка валидации: 200 с формой и сохранёнными полями, private, no-store, noindex', async ({
    request,
    baseURL,
  }) => {
    const email = address('invalid')
    const response = await request.post('/api/contact', {
      form: form(email, { consent: '', message: 'коротко' }),
      headers: { origin: baseURL ?? '' },
    })
    expect(response.status()).toBe(200)
    expect(response.headers()['cache-control']).toBe('private, no-store')
    const html = await response.text()
    expect(html).toContain('<meta name="robots" content="noindex"')
    expect(html).not.toContain('rel="canonical"')
    expect(html).toContain('role="alert"')
    // Страница ответа — on-demand HTML: скрипты на ней — только острова политики, и CSP та же, что у
    // страниц сайта.
    expect(scriptViolations(html)).toEqual([])
    expect(cspProblems(html, response.headers()['content-security-policy'])).toEqual([])
    expect(edgeHeadersIn(response.headers())).toEqual([])
    // Поля возвращаются заполненными: письмо не набирают заново.
    expect(html).toContain(`value="${email}"`)
    expect(await delivered(request)).not.toContain(email)
  })

  test('канал недоступен: честный 500 с формой, вне кеша', async ({ request, baseURL }) => {
    const response = await request.post('/api/contact', {
      form: form(address('fail')),
      headers: { origin: baseURL ?? '' },
    })
    expect(response.status()).toBe(500)
    expect(response.headers()['cache-control']).toBe('private, no-store')
    const html = await response.text()
    expect(html).toContain('role="alert"')
    expect(html).toContain('<meta name="robots" content="noindex"')
    expect(scriptViolations(html)).toEqual([])
    expect(cspProblems(html, response.headers()['content-security-policy'])).toEqual([])
    expect(edgeHeadersIn(response.headers())).toEqual([])
  })

  test('чужой или отсутствующий Origin — 403 до разбора заявки', async ({ request }) => {
    const email = address('cross-site')
    const foreign = await request.post('/api/contact', {
      form: form(email),
      headers: { origin: 'https://evil.example' },
      maxRedirects: 0,
    })
    expect(foreign.status()).toBe(403)
    expectRefusal(foreign)
    // Браузер шлёт Origin на POST формы всегда: без него и без Referer — отказ.
    const anonymous = await request.post('/api/contact', { form: form(email), maxRedirects: 0 })
    expect(anonymous.status()).toBe(403)
    expect(await delivered(request)).not.toContain(email)
  })

  test('за прокси: Origin сайта при чужом Host — заявка принимается', async ({
    request,
    baseURL,
  }) => {
    // Origin сверяется с runtime SITE_URL, а не с URL, который собрал адаптер из Host.
    const email = address('proxy')
    const response = await request.post('/api/contact', {
      form: form(email),
      headers: { origin: baseURL ?? '', host: 'demo.example' },
      maxRedirects: 0,
    })
    expect(response.status()).toBe(303)
    await expect.poll(() => delivered(request)).toContain(email)
  })

  test('тело не форма или битое — 400; больше лимита — 413 по Content-Length', async ({
    request,
    baseURL,
  }) => {
    const origin = baseURL ?? ''
    const json = await request.post('/api/contact', {
      headers: { origin, 'content-type': 'application/json' },
      data: '{"name":"бот"}',
    })
    expect(json.status()).toBe(400)
    expectRefusal(json)
    const broken = await request.post('/api/contact', {
      headers: { origin, 'content-type': 'multipart/form-data' },
      data: 'broken',
    })
    expect(broken.status()).toBe(400)
    const huge = await request.post('/api/contact', {
      form: form(address('huge'), { message: 'x'.repeat(70_000) }),
      headers: { origin },
      maxRedirects: 0,
    })
    expect(huge.status()).toBe(413)
    expectRefusal(huge)
  })

  test('GET обработчика возвращает на форму', async ({ request }) => {
    const response = await request.get('/api/contact', { maxRedirects: 0 })
    expect(response.status()).toBe(303)
    expect(response.headers().location).toBe('/contacts')
  })
})
