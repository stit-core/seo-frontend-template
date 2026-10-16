import { expect, test } from '@playwright/test'
import {
  botUserAgents,
  crawlerFiles,
  onDemandRoutes,
  pageTemplates,
  redirects,
  requestTarget,
  wrapperAnswers,
} from '../site'

const BROWSER =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
// Адрес без страницы: отказ боту — тот же, что человеку.
const UNKNOWN = '/net-takogo-adresa'

// Заголовки, которые различаются у двух ответов на один и тот же запрос: время ответа и id запроса,
// который приложение генерирует само. Все остальные обязаны совпасть.
const VARIABLE_HEADERS = ['date', 'x-request-id']

const comparable = (headers: Record<string, string>) =>
  Object.fromEntries(Object.entries(headers).filter(([name]) => !VARIABLE_HEADERS.includes(name)))

// Боту — тот же ответ, что человеку: ни отказа по User-Agent, ни отдельной версии страницы, ни
// своего заголовка. Кого пускать, решает robots.txt (политика ИИ-ботов сайта), а не сервер; тот же
// принцип edge держит по контракту (docs/reference/infra-handoff.md § Боты).
test.describe('ответ ботам реестра', () => {
  const agents = botUserAgents()
  const templates = pageTemplates()
  // Не только файлы и приложение: на адрес правила redirects.yaml и на неканоническую форму отвечает
  // обёртка процесса — боту тем же переездом и тем же отказом.
  const paths = new Set([
    ...templates,
    ...onDemandRoutes(),
    ...crawlerFiles(),
    UNKNOWN,
    ...redirects().map(requestTarget),
    ...wrapperAnswers(),
  ])

  test('матрица не пуста: шаблоны страниц, on-demand маршруты, файлы для краулеров, ответы обёртки и боты всех назначений', () => {
    expect(templates.length, 'шаблоны страниц сборки').toBeGreaterThan(0)
    expect(onDemandRoutes()).toContain('/robots.txt')
    expect(crawlerFiles()).toContain('/sitemap.xml')
    expect(
      [...paths].some((path) => path.endsWith('/index.html')),
      'неканоническая форма страницы',
    ).toBe(true)
    expect(Object.keys(agents)).toEqual(
      expect.arrayContaining([
        'YandexBot',
        'Googlebot',
        'bingbot',
        'OAI-SearchBot',
        'PerplexityBot',
        'Claude-SearchBot',
        'ChatGPT-User',
        'GPTBot',
        'ClaudeBot',
        'CCBot',
        'AdsBot-Google',
        'YaDirectFetcher',
        'facebookexternalhit',
      ]),
    )
  })

  for (const path of paths) {
    test(`${path}: каждому боту — те же статус, заголовки и тело, что браузеру`, async ({
      request,
    }) => {
      const get = (userAgent: string) =>
        request.get(path, { headers: { 'user-agent': userAgent }, maxRedirects: 0 })
      const browser = await get(BROWSER)
      if (templates.includes(path)) expect(browser.status()).toBe(200)
      const body = await browser.text()
      for (const [token, userAgent] of Object.entries(agents)) {
        const response = await get(userAgent)
        expect(response.status(), token).toBe(browser.status())
        expect(comparable(response.headers()), token).toEqual(comparable(browser.headers()))
        expect(await response.text(), token).toBe(body)
      }
    })
  }
})

// Язык выбирает человек ссылкой, а не сервер заголовком: робот без Accept-Language и браузер с
// любым получают одну страницу — ни редиректа на «свою» локаль, ни другой версии.
test('Accept-Language не меняет ответ: шаблоны страниц и адрес без страницы', async ({
  request,
}) => {
  const templates = pageTemplates()
  for (const path of [...templates, UNKNOWN]) {
    const get = (headers: Record<string, string>) => request.get(path, { headers, maxRedirects: 0 })
    const plain = await get({})
    if (templates.includes(path)) expect(plain.status(), path).toBe(200)
    const body = await plain.text()
    for (const language of ['en-US,en;q=0.9', 'ru-RU,ru;q=0.9', 'de']) {
      const response = await get({ 'accept-language': language })
      expect(response.status(), `${path} · ${language}`).toBe(plain.status())
      expect(comparable(response.headers()), `${path} · ${language}`).toEqual(
        comparable(plain.headers()),
      )
      expect(await response.text(), `${path} · ${language}`).toBe(body)
    }
  }
})

// llms.txt сайт не публикует: читателей среди поисковых и ИИ-ботов у файла нет. Адрес отвечает
// честным 404 текстом — не HTML-заглушкой и не ошибкой сервера.
test('/llms.txt и /llms-full.txt — 404 text/plain', async ({ request }) => {
  for (const path of ['/llms.txt', '/llms-full.txt']) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(404)
    expect(response.headers()['content-type'], path).toContain('text/plain')
    expect(await response.text(), path).not.toContain('<')
  }
})
