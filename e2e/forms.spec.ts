import { expect, test } from '@playwright/test'
import { FORM_STUB_PORT } from './site'

const STUB = `http://127.0.0.1:${FORM_STUB_PORT}`
const MESSAGE = 'Нужен сайт с блогом, формой заявки и картой сайта. Бюджет обсудим.'

// Адрес уникален на тест: приёмник общий, а спеки идут параллельно.
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

const delivered = async (request: {
  get: (url: string) => Promise<{ json: () => Promise<unknown> }>
}) => (await (await request.get(`${STUB}/received`)).json()) as string[]

test.describe('форма обратной связи без JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('браузер без JS: заявка уходит, PRG приводит на страницу подтверждения', async ({
    page,
    request,
  }) => {
    const email = address('ok')
    await page.goto('/contacts')
    await page.getByLabel('Как вас зовут').fill('Мария')
    await page.getByLabel('Почта для ответа').fill(email)
    await page.getByLabel('Что нужно сделать').fill(MESSAGE)
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Отправить заявку' }).click()

    await expect(page).toHaveURL('/contacts/spasibo')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Заявка отправлена')
    await expect.poll(() => delivered(request)).toContain(email)
  })

  test('без галочки согласия браузер не отправляет форму и без JavaScript', async ({
    page,
    request,
  }) => {
    const email = address('no-consent')
    await page.goto('/contacts')
    await page.getByLabel('Как вас зовут').fill('Мария')
    await page.getByLabel('Почта для ответа').fill(email)
    await page.getByLabel('Что нужно сделать').fill(MESSAGE)
    await page.getByRole('button', { name: 'Отправить заявку' }).click()

    // Нативная валидация required работает и без скриптов: страница та же, заявки нет.
    await expect(page).toHaveURL('/contacts')
    await expect(page.getByRole('checkbox')).not.toBeChecked()
    expect(await delivered(request)).not.toContain(email)
  })
})

test.describe('обработчик формы: статусы и антиспам', () => {
  const post = (fields: Record<string, string>, baseURL: string) => ({
    form: fields,
    headers: { origin: baseURL },
  })

  test('успех — 303 на /contacts/spasibo, заявка доставлена', async ({ request, baseURL }) => {
    const email = address('prg')
    const response = await request.post('/api/contact', {
      ...post(form(email), baseURL as string),
      maxRedirects: 0,
    })
    expect(response.status()).toBe(303)
    expect(response.headers().location).toBe('/contacts/spasibo')
    await expect.poll(() => delivered(request)).toContain(email)
  })

  test('английская форма приводит на английское подтверждение', async ({ request, baseURL }) => {
    const email = address('en')
    const response = await request.post('/api/contact', {
      ...post(form(email, { locale: 'en' }), baseURL as string),
      maxRedirects: 0,
    })
    expect(response.status()).toBe(303)
    expect(response.headers().location).toBe('/en/contacts/spasibo')
  })

  test('ловушка заполнена: ответ как у человека, доставки нет', async ({ request, baseURL }) => {
    const email = address('honeypot')
    const response = await request.post('/api/contact', {
      ...post(form(email, { company: 'ООО Спам' }), baseURL as string),
      maxRedirects: 0,
    })
    expect(response.status()).toBe(303)
    expect(response.headers().location).toBe('/contacts/spasibo')
    // Пауза даёт доставке шанс произойти — её не должно быть.
    await new Promise((done) => setTimeout(done, 300))
    expect(await delivered(request)).not.toContain(email)
  })

  test('ошибка валидации: 200 с формой, private/no-store и noindex', async ({
    request,
    baseURL,
  }) => {
    const email = address('invalid')
    const response = await request.post('/api/contact', {
      ...post(form(email, { consent: '', message: 'коротко' }), baseURL as string),
    })
    expect(response.status()).toBe(200)
    expect(response.headers()['cache-control']).toBe('private, no-store')
    const html = await response.text()
    expect(html).toContain('<meta name="robots" content="noindex"')
    expect(html).toContain('role="alert"')
    expect(html).toContain('Сообщение — от 10 до 2000 знаков.')
    // Поля возвращаются заполненными: письмо не набирают заново.
    expect(html).toContain(`value="${email}"`)
    expect(html).not.toContain('rel="canonical"')
    expect(await delivered(request)).not.toContain(email)
  })

  test('канал недоступен: честный 500 с текстом ошибки, заявка не потеряна молча', async ({
    request,
    baseURL,
  }) => {
    const response = await request.post('/api/contact', {
      ...post(form(address('fail')), baseURL as string),
    })
    expect(response.status()).toBe(500)
    expect(response.headers()['cache-control']).toBe('private, no-store')
    expect(await response.text()).toContain('сбой доставки')
  })

  test('чужой Origin — 403 до обработки, ответ вне кеша и индекса', async ({ request }) => {
    const email = address('cross-site')
    const response = await request.post('/api/contact', {
      form: form(email),
      headers: { origin: 'https://evil.example' },
      maxRedirects: 0,
    })
    expect(response.status()).toBe(403)
    expect(response.headers()['cache-control']).toBe('private, no-store')
    expect(response.headers()['x-robots-tag']).toBe('noindex')
    expect(await delivered(request)).not.toContain(email)
  })

  test('без Origin и Referer — 403: браузер шлёт Origin на POST формы всегда', async ({
    request,
  }) => {
    const response = await request.post('/api/contact', {
      form: form(address('no-origin')),
      maxRedirects: 0,
    })
    expect(response.status()).toBe(403)
  })

  test('за прокси: Origin сайта при чужом Host — заявка принимается', async ({
    request,
    baseURL,
  }) => {
    // SITE_URL контейнера = baseURL, поэтому Host из запроса ни на что не влияет: origin
    // сверяется с SITE_URL, а не с URL, который собрал адаптер.
    const email = address('proxy')
    const response = await request.post('/api/contact', {
      form: form(email),
      headers: { origin: baseURL as string, host: 'demo.example' },
      maxRedirects: 0,
    })
    expect(response.status()).toBe(303)
    await expect.poll(() => delivered(request)).toContain(email)
  })

  test('тело не форма: 400 без страницы и без события наблюдаемости', async ({
    request,
    baseURL,
  }) => {
    const response = await request.post('/api/contact', {
      headers: { origin: baseURL as string, 'content-type': 'application/json' },
      data: '{"name":"бот"}',
    })
    expect(response.status()).toBe(400)
    expect(response.headers()['cache-control']).toBe('private, no-store')
    expect(response.headers()['x-robots-tag']).toBe('noindex')
  })

  test('битое тело формы: 400, а не 500', async ({ request, baseURL }) => {
    const response = await request.post('/api/contact', {
      headers: { origin: baseURL as string, 'content-type': 'multipart/form-data' },
      data: 'broken',
    })
    expect(response.status()).toBe(400)
  })

  test('тело больше лимита: 413 по Content-Length', async ({ request, baseURL }) => {
    const response = await request.post('/api/contact', {
      ...post(form(address('huge'), { message: 'x'.repeat(70_000) }), baseURL as string),
      maxRedirects: 0,
    })
    expect(response.status()).toBe(413)
    expect(response.headers()['cache-control']).toBe('private, no-store')
  })

  test('GET обработчика возвращает на форму', async ({ request }) => {
    const response = await request.get('/api/contact', { maxRedirects: 0 })
    expect(response.status()).toBe(303)
    expect(response.headers().location).toBe('/contacts')
  })
})
