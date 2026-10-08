import { expect, test } from '@playwright/test'
import { botUserAgents, pageTemplates } from '../site'

const BROWSER =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

// Боту — тот же ответ, что человеку: ни отказа по User-Agent, ни отдельной версии страницы, ни
// своей директивы индексации. Кого пускать, решает robots.txt (политика ИИ-ботов сайта), а не
// сервер; тот же принцип edge держит по контракту (docs/reference/infra-handoff.md § 1.5).
test.describe('ответ поисковым и user-fetch ботам реестра', () => {
  const agents = botUserAgents()

  test('реестр читается: в матрице классический поиск, ИИ-поиск и загрузки по запросу человека', () => {
    expect(Object.keys(agents)).toEqual(
      expect.arrayContaining([
        'YandexBot',
        'Googlebot',
        'bingbot',
        'OAI-SearchBot',
        'PerplexityBot',
        'Claude-SearchBot',
        'ChatGPT-User',
      ]),
    )
  })

  test('шаблоны страниц, robots.txt и карта сайта под UA каждого бота — 200, то же тело и тот же X-Robots-Tag, что браузеру', async ({
    request,
  }) => {
    const templates = pageTemplates()
    expect(templates.length, 'шаблоны страниц сборки').toBeGreaterThan(0)
    for (const path of [...templates, '/robots.txt', '/sitemap.xml']) {
      const browser = await request.get(path, { headers: { 'user-agent': BROWSER } })
      expect(browser.status(), path).toBe(200)
      const body = await browser.text()
      for (const [token, userAgent] of Object.entries(agents)) {
        const response = await request.get(path, { headers: { 'user-agent': userAgent } })
        expect(response.status(), `${token} ${path}`).toBe(200)
        expect(response.headers()['x-robots-tag'], `${token} ${path}`).toBe(
          browser.headers()['x-robots-tag'],
        )
        expect(await response.text(), `${token} ${path}`).toBe(body)
      }
    }
  })
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
