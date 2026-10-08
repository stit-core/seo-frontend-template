import { expect, test } from '@playwright/test'
import { bodyOf, type HeadTag, headTags, isNoindex, jsonLdBlocks } from '../../scripts/lib/html.mjs'
import { scriptViolations } from '../../scripts/lib/site-policy.mjs'
import { SITE_ORIGIN_PLACEHOLDER } from '../../src/shared/config/runtime.ts'
import { OG_DEFAULT_IMAGE } from '../../src/shared/config/site.ts'
import { t } from '../../src/shared/i18n/dict.ts'
import {
  DEFAULT_LOCALE,
  localeOf,
  localePath,
  SUPPORTED_LOCALES,
} from '../../src/shared/i18n/locale.ts'
import {
  cspProblems,
  edgeHeadersIn,
  entries,
  onDemandRoutes,
  prerenderedPaths,
  rawGet,
  redirects,
  requestTarget,
  THROWING_REQUESTS,
} from '../site'

const PLACEHOLDER = new URL(SITE_ORIGIN_PLACEHOLDER).hostname
const UNKNOWN = '/net-takogo-adresa'

const serverTime = (html: string) => /<time datetime="([^"]+)"/.exec(html)?.[1]

// Служебная страница: только noindex, без canonical, OG, hreflang и разметки.
function expectServicePage(html: string, path: string) {
  const tags = headTags(html)
  const has = (match: (tag: HeadTag) => boolean) => tags.some(match)
  expect(tags.find((tag) => tag.name === 'robots')?.content, path).toBe('noindex')
  expect(
    has((tag) => tag.rel === 'canonical'),
    path,
  ).toBe(false)
  expect(
    has((tag) => tag.hreflang !== undefined),
    path,
  ).toBe(false)
  expect(
    has((tag) => tag.property?.startsWith('og:') === true),
    path,
  ).toBe(false)
  expect(jsonLdBlocks(html), path).toEqual([])
  expect(html.match(/<h1[\s>]/g), path).toHaveLength(1)
}

test.describe('on-demand: ответы приложения', () => {
  test('каждый маршрут prerender = false отвечает из приложения: X-Request-Id, без заголовков edge, HTML — только noindex и с CSP, без плейсхолдера и своего origin в теле', async ({
    request,
    baseURL,
  }) => {
    for (const path of onDemandRoutes()) {
      const response = await request.get(path, { maxRedirects: 0 })
      expect(response.headers()['x-request-id'], path).toBeTruthy()
      expect(edgeHeadersIn(response.headers()), path).toEqual([])
      const body = await response.text()
      expect(body, path).not.toContain(PLACEHOLDER)
      if (body.includes('<body')) expect(bodyOf(body), path).not.toContain(baseURL)
      // Индексируемая страница — только prerendered: on-demand документ вне карты сайта, и без
      // noindex (метой или заголовком) он попал бы в индекс мимо неё.
      if (body.includes('<html')) {
        const closed =
          isNoindex(headTags(body)) || /noindex/.test(response.headers()['x-robots-tag'] ?? '')
        expect(closed, `${path}: on-demand HTML без noindex`).toBe(true)
        expect(cspProblems(body, response.headers()['content-security-policy']), path).toEqual([])
      }
    }
  })

  test('адрес вне сборки — честный 404 служебной страницей: no-cache, ссылки страницы живые', async ({
    request,
  }) => {
    const published = entries().filter((entry) => !entry.draft)
    const paths = new Set(published.map((entry) => entry.path))
    // Черновик в сборку не попадает: его адрес — 404, а не страница.
    const draft = entries().find((entry) => entry.draft)?.path
    // Непереведённая запись под чужим префиксом — 404, а не копия.
    const foreign = published
      .flatMap((entry) => SUPPORTED_LOCALES.map((locale) => localePath(locale, entry.route)))
      .find((path) => !paths.has(path))
    for (const path of [UNKNOWN, draft, foreign].filter((path) => path !== undefined)) {
      const response = await request.get(path, { maxRedirects: 0 })
      expect(response.status(), path).toBe(404)
      expect(response.headers()['cache-control'], path).toBe('no-cache')
      expect(response.headers()['x-request-id'], path).toBeTruthy()
    }

    const html = await (await request.get(UNKNOWN)).text()
    expectServicePage(html, UNKNOWN)
    // check:links видит только dist/client — ссылки on-demand страницы проверяются здесь.
    for (const [, href] of html.matchAll(/<a[^>]* href="(\/[^"]*)"/g)) {
      expect((await request.get(href ?? '')).status(), href).toBe(200)
    }
  })

  // Страница ошибки — на языке адреса и только на нём.
  test('404 — на языке префикса пути: lang, текст и ссылка на главную своей локали, без второго языка', async ({
    request,
  }) => {
    for (const locale of SUPPORTED_LOCALES) {
      const path = localePath(locale, UNKNOWN)
      const response = await request.get(path)
      expect(response.status(), path).toBe(404)
      const html = await response.text()
      expect(html, path).toContain(`<html lang="${locale}"`)
      expectServicePage(html, path)
      const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'))
      expect(main, path).toContain(t(locale, 'notFound.title'))
      expect(main, path).toContain(`href="${localePath(locale, '/')}"`)
      expect(main, path).not.toContain(' lang="')
      for (const other of SUPPORTED_LOCALES.filter((candidate) => candidate !== locale)) {
        expect(main, `${path}: текст локали ${other}`).not.toContain(t(other, 'notFound.lead'))
      }
    }
  })

  test('страница 500 — дефолтная локаль и один язык', async ({ request }) => {
    const html = await (await request.get('/500.html')).text()
    expect(html).toContain(`<html lang="${DEFAULT_LOCALE}"`)
    const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'))
    expect(main).toContain(t(DEFAULT_LOCALE, 'error.lead'))
    expect(main).not.toContain(' lang="')
    for (const other of SUPPORTED_LOCALES.filter((locale) => locale !== DEFAULT_LOCALE)) {
      expect(main, other).not.toContain(t(other, 'error.lead'))
    }
  })

  test('on-demand страницы: скрипты — только острова политики (prerendered держит seo:check)', async ({
    request,
  }) => {
    for (const path of [UNKNOWN, ...onDemandRoutes()]) {
      expect(scriptViolations(await (await request.get(path)).text()), path).toEqual([])
    }
  })

  // Картинки оптимизирует сборка; трансформация на запрос — CPU и память процесса для любого клиента.
  test('/_image закрыт: 404 текстом на любую картинку, on-demand страницы на него не ссылаются', async ({
    request,
  }) => {
    const home = await (await request.get('/')).text()
    const built = /\/_astro\/[^"' ,]+\.(?:webp|avif|png|jpe?g)/.exec(home)?.[0]
    const sources = [OG_DEFAULT_IMAGE.path, built, 'https://example.com/x.png']
    for (const href of sources.filter((source) => source !== undefined)) {
      const response = await request.get(
        `/_image?href=${encodeURIComponent(href)}&w=1600&f=avif&q=100`,
      )
      expect(response.status(), href).toBe(404)
      expect(response.headers()['content-type'], href).toContain('text/plain')
    }
    for (const path of [UNKNOWN, ...onDemandRoutes()]) {
      expect(await (await request.get(path)).text(), path).not.toContain('/_image')
    }
  })

  test('/healthz — 200 ok, no-store, X-Request-Id из запроса', async ({ request }) => {
    const response = await request.get('/healthz', { headers: { 'x-request-id': 'e2e-rid' } })
    expect(response.status()).toBe(200)
    expect(await response.text()).toBe('ok')
    expect(response.headers()['cache-control']).toBe('no-store')
    expect(response.headers()['x-request-id']).toBe('e2e-rid')
  })

  test('/now — рендер на каждый запрос: private, no-store, noindex, время меняется', async ({
    request,
  }) => {
    const first = await request.get('/now', { headers: { 'x-request-id': 'e2e-now' } })
    expect(first.status()).toBe(200)
    expect(first.headers()['cache-control']).toBe('private, no-store')
    expect(first.headers()['x-request-id']).toBe('e2e-now')
    expect(first.headers()['x-robots-tag']).toBeUndefined()
    const html = await first.text()
    expect(html).toContain(`<html lang="${DEFAULT_LOCALE}"`)
    expectServicePage(html, '/now')
    expect(serverTime(html)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    // Разрешение метки — миллисекунда: пауза гарантирует разное время у двух рендеров.
    await new Promise((done) => setTimeout(done, 10))
    expect(serverTime(await (await request.get('/now')).text())).not.toBe(serverTime(html))
  })
})

// Исключение слушателя адаптера не доходит до процесса: без перехвата в обёртке (docker/server.mjs)
// один анонимный запрос завершал бы сервер.
test.describe('запрос, на котором адаптер бросает исключение', () => {
  test('400 от обёртки процесса, следом /healthz — 200: процесс жив', async ({ request }) => {
    for (const { name, path, ...options } of THROWING_REQUESTS) {
      expect((await request.fetch(path, options)).status(), name).toBe(400)
      expect((await request.get('/healthz')).status(), `/healthz после: ${name}`).toBe(200)
    }
  })
})

// У адреса одна форма: любую другую обёртка процесса закрывает одним 301 раньше статик-хендлера,
// который отдал бы по ней ту же страницу (дубль) или второй хоп.
test.describe('один адрес — одна форма', () => {
  const pages = prerenderedPaths().filter((path) => path !== '/')
  // Страница верхнего уровня и вложенная: у второй есть сегмент, который можно обойти точками.
  const flat = pages.find((path) => path.lastIndexOf('/') === 0) ?? ''
  const nested = pages.find((path) => path.lastIndexOf('/') > 0) ?? ''
  const parent = nested.slice(0, nested.lastIndexOf('/'))
  const leaf = nested.slice(nested.lastIndexOf('/') + 1)

  test('неканоническая форма страницы — один 301 сразу на её адрес: слеш, //, index.html, точки, проценты', async ({
    baseURL,
  }) => {
    expect(flat, 'страница верхнего уровня в сборке').not.toBe('')
    expect(nested, 'вложенная страница в сборке').not.toBe('')
    const forms: [form: string, canonical: string][] = [
      [`${flat}/`, flat],
      [`/${flat}`, flat],
      [`${flat}/index.html`, flat],
      [`/.${flat}`, flat],
      [`${flat}/?x=1&y=2`, `${flat}?x=1&y=2`],
      ['/index.html', '/'],
      ['//', '/'],
      [`${nested}/`, nested],
      [`${parent}//${leaf}`, nested],
      [`${parent}/./${leaf}/index.html`, nested],
      [`${parent}/x/../${leaf}`, nested],
      // Буква, записанная процентами, — тот же адрес в другой записи.
      [`/%${flat.charCodeAt(1).toString(16)}${flat.slice(2)}`, flat],
    ]
    for (const [form, canonical] of forms) {
      const response = await rawGet(baseURL, form)
      expect(response.status, form).toBe(301)
      expect(response.headers.location, form).toBe(canonical)
      expect((await rawGet(baseURL, canonical)).status, `${form} → ${canonical}`).toBe(200)
    }
  })

  // Обёртка и приложение читают один и тот же адрес: редирект на форму, которую вторая сторона
  // сочла бы неканонической, — петля.
  test('любая запись пути — не больше одного редиректа, дальше ответ', async ({ baseURL }) => {
    const exotic = [
      '/a%5Bb%5D',
      '/a[b]',
      '/a%7Cb',
      '/a|b',
      '/100%25',
      '/%2561bout',
      '/a%2Bb',
      '/a%3Fb%23c',
      '/~a/(b)',
      '/a%20b/',
      '/%C3%A9t%c3%a9/',
      `/%25${flat.charCodeAt(1).toString(16)}${flat.slice(2)}/index.html`,
    ]
    for (const form of exotic) {
      const first = await rawGet(baseURL, form)
      const last =
        first.status === 301 ? await rawGet(baseURL, String(first.headers.location)) : first
      expect([200, 404], `${form} → ${String(first.headers.location ?? '')}`).toContain(last.status)
    }
  })

  test('спрятанный разделитель в пути (%2F, %5C) — 404 текстом, а не страница и не редирект', async ({
    baseURL,
  }) => {
    for (const form of [`${parent}%2F${leaf}`, `${parent}%2f${leaf}/`, `${parent}%5C${leaf}`]) {
      const response = await rawGet(baseURL, form)
      expect(response.status, form).toBe(404)
      expect(response.headers.location, form).toBeUndefined()
      expect(response.headers['content-type'], form).toContain('text/plain')
    }
  })

  test('заглавные в своём адресе — другой адрес: 404, а не редирект на строчные', async ({
    baseURL,
  }) => {
    for (const form of [flat.toUpperCase(), nested.toUpperCase()]) {
      const response = await rawGet(baseURL, form)
      expect(response.status, form).toBe(404)
      expect(response.headers.location, form).toBeUndefined()
    }
  })
})

test.describe('адреса как данные (content/redirects.yaml)', () => {
  const moves = redirects().filter((rule) => 'to' in rule)
  const gone = redirects().filter((rule) => rule.status === 410)
  // Путь с парами query правила: канонический адрес правила — `withPath(rule, rule.path)`.
  const withPath = (rule: { from: string }, path: string) =>
    `${path}${rule.from.includes('?') ? rule.from.slice(rule.from.indexOf('?')) : ''}`

  test('переезд: адрес правила в любой форме — один хоп на конечный адрес', async ({ baseURL }) => {
    test.skip(moves.length === 0, 'в redirects.yaml нет переездов')
    for (const rule of moves) {
      if (!('to' in rule)) continue
      const forms = [
        requestTarget(rule),
        withPath(rule, rule.path),
        withPath(rule, `${rule.path === '/' ? '' : rule.path}/`),
        withPath(rule, `/${rule.path}`),
        withPath(
          rule,
          rule.path.toLowerCase() === rule.path
            ? rule.path
            : rule.path.replace(/%[0-9A-F]{2}/g, (hex) => hex.toLowerCase()),
        ),
      ]
      for (const form of forms) {
        const response = await rawGet(baseURL, form)
        expect(response.status, form).toBe(rule.status)
        expect(response.headers.location, form).toBe(rule.to)
      }
      // Конечный адрес отвечает сам: ни цепочки, ни второго хопа.
      if (rule.to.startsWith('/'))
        expect((await rawGet(baseURL, rule.to)).status, rule.to).toBe(200)
    }
  })

  test('переезд: параметры запроса переезжают в Location, пары самого правила — нет', async ({
    baseURL,
  }) => {
    test.skip(moves.length === 0, 'в redirects.yaml нет переездов')
    for (const rule of moves) {
      if (!('to' in rule) || !rule.to.startsWith('/')) continue
      const target = requestTarget(rule)
      const response = await rawGet(baseURL, `${target}${target.includes('?') ? '&' : '?'}x=1&y=2`)
      expect(response.status, target).toBe(rule.status)
      expect(response.headers.location, target).toBe(`${rule.to}?x=1&y=2`)
    }
  })

  test('правило с ?query не срабатывает на голый путь и на другое значение параметра', async ({
    baseURL,
  }) => {
    const rule = moves.find((candidate) => candidate.query.length > 0)
    test.skip(!rule, 'в redirects.yaml нет правила с query')
    if (!rule) return
    const [[key, value] = ['', '']] = rule.query
    for (const form of [rule.path, `${rule.path}?${key}=${value}0`]) {
      const response = await rawGet(baseURL, form)
      expect(response.headers.location, form).toBeUndefined()
      expect([200, 404], form).toContain(response.status)
    }
  })

  test('удалённый адрес — 410 на языке его префикса, с noindex и no-cache; из другой формы — один 301 на него', async ({
    baseURL,
  }) => {
    test.skip(gone.length === 0, 'в redirects.yaml нет 410')
    for (const rule of gone) {
      // 410 отвечает одна форма удалённого адреса — каноническая.
      const address = withPath(rule, rule.path)
      const response = await rawGet(baseURL, address)
      expect(response.status, rule.from).toBe(410)
      expect(response.headers['x-robots-tag'], rule.from).toContain('noindex')
      expect(response.headers['cache-control'], rule.from).toBe('no-cache')
      expect(response.headers['x-request-id'], rule.from).toBeTruthy()
      const locale = localeOf(rule.path)
      expect(response.body, rule.from).toContain(`<html lang="${locale}">`)
      expect(response.body, rule.from).toContain(`<h1>${t(locale, 'gone.title')}</h1>`)
      expect(response.body, rule.from).toContain(`href="${localePath(locale, '/')}"`)
      for (const other of SUPPORTED_LOCALES.filter((candidate) => candidate !== locale)) {
        expect(response.body, `${rule.from}: текст локали ${other}`).not.toContain(
          t(other, 'gone.lead'),
        )
      }
      // Запись `from` со слешем старого сайта — такая же другая форма, как любая.
      const forms = [
        requestTarget(rule),
        withPath(rule, `${rule.path}/`),
        withPath(rule, `/${rule.path}`),
        withPath(rule, `${rule.path}/index.html`),
      ]
      for (const form of forms.filter((candidate) => candidate !== address)) {
        const moved = await rawGet(baseURL, form)
        expect(moved.status, form).toBe(301)
        expect(moved.headers.location, form).toBe(address)
      }
    }
  })
})
