import { expect, test } from '@playwright/test'
import { OG_DEFAULT_IMAGE } from '../../src/shared/config/site.ts'
import { onDemandRoutes, prerenderedPaths, redirects } from '../site'

// Контур staging (ROBOTS_POLICY=noindex): тот же образ, закрытый процессом. Заголовок ставит обёртка
// сервера, поэтому он есть и там, куда приложение не доходит, — у статики адаптера.
test.describe('staging: ROBOTS_POLICY=noindex', () => {
  test('robots.txt закрывает сайт целиком и не называет карту', async ({ request }) => {
    const response = await request.get('/robots.txt')
    expect(response.status()).toBe(200)
    expect(await response.text()).toBe('User-agent: *\nDisallow: /\n')
  })

  test('каждый ответ процесса — X-Robots-Tag: noindex, nofollow: страницы сборки, ассеты, public/*, on-demand, 404, редиректы', async ({
    request,
  }) => {
    const home = await (await request.get('/')).text()
    const stylesheet = /<link rel="stylesheet" href="(\/_astro\/[^"]+\.css)"/.exec(home)?.[1]
    expect(stylesheet, 'таблица стилей в <head> главной').toBeTruthy()
    const paths = [
      ...prerenderedPaths(),
      stylesheet ?? '',
      OG_DEFAULT_IMAGE.path,
      ...onDemandRoutes(),
      '/net-takogo-adresa',
      ...redirects().map((rule) => rule.from),
    ]
    for (const path of paths) {
      const response = await request.get(path, { maxRedirects: 0 })
      expect(response.headers()['x-robots-tag'], path).toBe('noindex, nofollow')
    }
  })
})
