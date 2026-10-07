import { expect, test } from '@playwright/test'
import { bodyOf, headTags } from '../../scripts/lib/html.mjs'
import { SITE_ORIGIN_PLACEHOLDER } from '../../src/shared/config/runtime.ts'
import { cspProblems, edgeHeadersIn, indexablePaths, prerenderedPaths } from '../site'

// Голый хост плейсхолдера: ловит и полный URL, и упоминание без схемы.
const PLACEHOLDER = new URL(SITE_ORIGIN_PLACEHOLDER).hostname
// Googlebot качает первые 2 МБ и молча обрезает остальное; потолок шаблона сильно ниже.
const HTML_SIZE_LIMIT = 300_000
const GOOGLEBOT = {
  'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
}

test.describe('prerendered-страницы — как их отдаёт контейнер', () => {
  test('каждая страница сборки: 200 от статик-хендлера, CSP без заголовков edge, origin проштампован, тело без своего origin', async ({
    request,
    baseURL,
  }) => {
    const indexable = new Set(indexablePaths())
    for (const path of prerenderedPaths()) {
      const response = await request.get(path)
      expect(response.status(), path).toBe(200)
      // Статик-хендлер адаптера отдаёт файл до приложения: его заголовки, middleware не видна.
      expect(response.headers()['cache-control'], path).toBe('public, max-age=0')
      expect(response.headers().etag, path).toBeTruthy()
      expect(response.headers()['x-request-id'], path).toBeUndefined()
      // Прод-профиль: индексацию закрывать нечему.
      expect(response.headers()['x-robots-tag'], path).toBeUndefined()
      const html = await response.text()
      // CSP статики — из dist/_headers.json сборки: её ставит статик-хендлер, а не приложение.
      expect(cspProblems(html, response.headers()['content-security-policy']), path).toEqual([])
      expect(edgeHeadersIn(response.headers()), path).toEqual([])
      // Клоакинга нет: бот получает ровно тот же HTML, что и человек.
      expect(await (await request.get(path, { headers: GOOGLEBOT })).text(), path).toBe(html)
      expect(Buffer.byteLength(html, 'utf8'), path).toBeLessThan(HTML_SIZE_LIMIT)
      expect(html, path).not.toContain(PLACEHOLDER)
      // Абсолютные URL своего origin — только в <head>; в теле — корневые пути.
      expect(bodyOf(html), path).not.toContain(baseURL)
      if (indexable.has(path)) {
        const canonical = headTags(html).find((tag) => tag.rel === 'canonical')?.href
        expect(canonical, path).toBe(`${baseURL}${path}`)
      }
    }
  })

  test('ассеты сборки с хешем в имени — immutable', async ({ request }) => {
    const home = await (await request.get('/')).text()
    const stylesheet = /<link rel="stylesheet" href="(\/_astro\/[^"]+\.css)"/.exec(home)?.[1]
    expect(stylesheet, 'таблица стилей в <head> главной').toBeTruthy()
    const response = await request.get(stylesheet ?? '')
    expect(response.status()).toBe(200)
    expect(response.headers()['cache-control']).toContain('immutable')
  })
})
