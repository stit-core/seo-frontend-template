import { type APIRequestContext, expect, test } from '@playwright/test'
import { scriptViolations } from '../../scripts/lib/site-policy.mjs'
import { FORM_DICTS } from '../../src/features/lead-form/config/dict.ts'
import { DEFAULT_LOCALE, localePath, SUPPORTED_LOCALES } from '../../src/shared/i18n/locale.ts'
import {
  cspProblems,
  edgeHeadersIn,
  leadFieldsOf,
  leadForms,
  originOf,
  type PlanForm,
  pagePathOf,
} from '../site'

// Формы планов: поля набора, скрытые поля сборки, ловушка и страница «спасибо» — из плана и каталога. Исход заявки
// зависит от формы — его наборы проверяют у каждой; отказ до разбора заявки формы не знает — его хватает первой.
const PLANS = leadForms()
const [FIRST] = PLANS
if (FIRST === undefined) throw new Error('e2e: у планов нет формы')

// Метка уникальна на тест (адрес — она годится и полю почты): приёмник общий, а спеки идут параллельно. Метку с fail-
// приёмник отвергает — так проверяется отказ канала.
const address = (label: string) =>
  `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`

// Заявка формы на версии её страницы: поля набора с меткой, согласие и скрытые поля сборки — id формы и адрес страницы.
const form = (
  plan: PlanForm,
  marker: string,
  extra: Record<string, string> = {},
  locale = plan.locales[0] ?? DEFAULT_LOCALE,
) => ({
  ...leadFieldsOf(plan, marker),
  consent: '1',
  form_id: plan.id,
  page_url: localePath(locale, plan.url),
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
  test('заявка — PRG 303 на «спасибо» плана своей локали и доставка в канал', async ({
    request,
    baseURL,
  }) => {
    for (const plan of PLANS) {
      for (const locale of plan.locales) {
        const marker = address(`prg-${locale}`)
        const response = await request.post('/api/contact', {
          form: form(plan, marker, {}, locale),
          headers: { origin: baseURL ?? '' },
          maxRedirects: 0,
        })
        expect(response.status(), `${plan.id} ${locale}`).toBe(303)
        expect(response.headers().location, `${plan.id} ${locale}`).toBe(
          pagePathOf(plan.thankYou, locale),
        )
        await expect.poll(() => delivered(request)).toContain(marker)
      }
    }
  })

  test('ловушка заполнена: ответ как у человека, доставки нет', async ({ request, baseURL }) => {
    const markers: string[] = []
    for (const plan of PLANS) {
      const marker = address('honeypot')
      markers.push(marker)
      const response = await request.post('/api/contact', {
        form: form(plan, marker, { [plan.honeypot]: 'ООО Спам' }),
        headers: { origin: baseURL ?? '' },
        maxRedirects: 0,
      })
      expect(response.status(), plan.id).toBe(303)
      expect(response.headers().location, plan.id).toBe(
        pagePathOf(plan.thankYou, plan.locales[0] ?? DEFAULT_LOCALE),
      )
    }
    // Пауза даёт доставке шанс произойти — её не должно быть.
    await new Promise((done) => setTimeout(done, 300))
    const received = await delivered(request)
    for (const marker of markers) expect(received).not.toContain(marker)
  })

  test('ошибка валидации: 200 с формой и сохранёнными полями, private, no-store, noindex', async ({
    request,
    baseURL,
  }) => {
    for (const plan of PLANS) {
      const marker = address('invalid')
      const response = await request.post('/api/contact', {
        form: form(plan, marker, { consent: '' }),
        headers: { origin: baseURL ?? '' },
      })
      expect(response.status(), plan.id).toBe(200)
      expect(response.headers()['cache-control'], plan.id).toBe('private, no-store')
      const html = await response.text()
      expect(html, plan.id).toContain('<meta name="robots" content="noindex"')
      expect(html, plan.id).not.toContain('rel="canonical"')
      expect(html, plan.id).toContain('role="alert"')
      // Страница ответа — on-demand HTML: скрипты на ней — только острова политики, и CSP та же, что у
      // страниц сайта.
      expect(scriptViolations(html, '/api/contact'), plan.id).toEqual([])
      expect(cspProblems(html, response.headers()['content-security-policy']), plan.id).toEqual([])
      expect(edgeHeadersIn(response.headers()), plan.id).toEqual([])
      // Поля возвращаются заполненными — у своей формы: письмо не набирают заново.
      expect(html, plan.id).toContain(`name="form_id" value="${plan.id}"`)
      expect(html, plan.id).toContain(marker)
      expect(await delivered(request), plan.id).not.toContain(marker)
    }
  })

  test('канал недоступен: честный 500 с формой, вне кеша', async ({ request, baseURL }) => {
    for (const plan of PLANS) {
      const response = await request.post('/api/contact', {
        form: form(plan, address('fail')),
        headers: { origin: baseURL ?? '' },
      })
      expect(response.status(), plan.id).toBe(500)
      expect(response.headers()['cache-control'], plan.id).toBe('private, no-store')
      const html = await response.text()
      expect(html, plan.id).toContain('role="alert"')
      expect(html, plan.id).toContain('<meta name="robots" content="noindex"')
      expect(scriptViolations(html, '/api/contact'), plan.id).toEqual([])
      expect(cspProblems(html, response.headers()['content-security-policy']), plan.id).toEqual([])
      expect(edgeHeadersIn(response.headers()), plan.id).toEqual([])
    }
  })

  test('чужой или отсутствующий Origin — 403 до разбора заявки, текст на языке страницы', async ({
    request,
    baseURL,
  }) => {
    const marker = address('cross-site')
    for (const locale of SUPPORTED_LOCALES) {
      const foreign = await request.post('/api/contact', {
        form: form(FIRST, marker),
        headers: {
          origin: 'https://evil.example',
          referer: `${baseURL ?? ''}${localePath(locale, '/')}`,
        },
        maxRedirects: 0,
      })
      expect(foreign.status(), locale).toBe(403)
      expect(await foreign.text(), locale).toBe(FORM_DICTS[locale]['refusal.forbidden'])
      expectRefusal(foreign)
    }
    // Браузер шлёт Origin на POST формы всегда: без него и без Referer — отказ.
    const anonymous = await request.post('/api/contact', {
      form: form(FIRST, marker),
      maxRedirects: 0,
    })
    expect(anonymous.status()).toBe(403)
    expect(await delivered(request)).not.toContain(marker)
  })

  test('за прокси: Origin сайта при чужом Host — заявка принимается', async ({
    request,
    baseURL,
  }) => {
    // Origin сверяется с runtime SITE_URL, а не с URL, который собрал адаптер из Host.
    const marker = address('proxy')
    const response = await request.post('/api/contact', {
      form: form(FIRST, marker),
      headers: { origin: baseURL ?? '', host: 'demo.example' },
      maxRedirects: 0,
    })
    expect(response.status()).toBe(303)
    await expect.poll(() => delivered(request)).toContain(marker)
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
      form: form(FIRST, address('huge'), { padding: 'x'.repeat(70_000) }),
      headers: { origin },
      maxRedirects: 0,
    })
    expect(huge.status()).toBe(413)
    expectRefusal(huge)
  })

  // GET ведёт на страницу формы того языка, с которого пришёл: у формы на нём это её страница или страница другой формы.
  test('GET обработчика возвращает на страницу формы языка, с которого пришёл', async ({
    request,
    baseURL,
  }) => {
    for (const plan of PLANS) {
      for (const locale of plan.locales) {
        const page = localePath(locale, plan.url)
        const response = await request.get('/api/contact', {
          headers: { referer: `${baseURL ?? ''}${page}` },
          maxRedirects: 0,
        })
        const pages = PLANS.filter((other) => other.locales.includes(locale)).map((other) =>
          localePath(locale, other.url),
        )
        expect(response.status(), `${plan.id} ${locale}`).toBe(303)
        expect(pages, `${plan.id} ${locale}`).toContain(response.headers().location)
      }
    }
  })
})
