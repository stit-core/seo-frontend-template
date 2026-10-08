import { expect, test } from '@playwright/test'
import { OG_DEFAULT_IMAGE } from '../../src/shared/config/site.ts'
import {
  crawlerFiles,
  onDemandRoutes,
  prerenderedPaths,
  redirects,
  requestTarget,
  THROWING_REQUESTS,
} from '../site'

// Контур staging (ROBOTS_POLICY=noindex): тот же образ, закрытый процессом. Заголовок ставит обёртка
// сервера, поэтому он есть и там, куда приложение не доходит, — у статики адаптера.
test.describe('staging: ROBOTS_POLICY=noindex', () => {
  test('robots.txt закрывает сайт целиком и не называет карту', async ({ request }) => {
    const response = await request.get('/robots.txt')
    expect(response.status()).toBe(200)
    expect(await response.text()).toBe('User-agent: *\nDisallow: /\n')
  })

  test('каждый ответ процесса — X-Robots-Tag: noindex, nofollow: страницы сборки, карта и фиды, ассеты, public/*, on-demand, 404, адреса redirects.yaml, ответы обёртки на форму адреса', async ({
    request,
  }) => {
    const home = await (await request.get('/')).text()
    const stylesheet = /<link rel="stylesheet" href="(\/_astro\/[^"]+\.css)"/.exec(home)?.[1]
    expect(stylesheet, 'таблица стилей в <head> главной').toBeTruthy()
    const page = prerenderedPaths().find((path) => path !== '/') ?? ''
    const paths = [
      ...prerenderedPaths(),
      ...crawlerFiles(),
      stylesheet ?? '',
      OG_DEFAULT_IMAGE.path,
      ...onDemandRoutes(),
      '/net-takogo-adresa',
      ...redirects().map(requestTarget),
      // Ответы самой обёртки: 301 с неканонической формы и 404 на спрятанный разделитель.
      `${page}/`,
      `${page}/index.html`,
      `${page}%2Fx`,
    ]
    for (const path of paths) {
      const response = await request.get(path, { maxRedirects: 0 })
      expect(response.headers()['x-robots-tag'], path).toBe('noindex, nofollow')
    }
  })

  test('отказ обёртки на запрос, на котором адаптер бросает исключение, — 400 с тем же X-Robots-Tag, процесс жив', async ({
    request,
  }) => {
    for (const { name, path, ...options } of THROWING_REQUESTS) {
      const response = await request.fetch(path, options)
      expect(response.status(), name).toBe(400)
      expect(response.headers()['x-robots-tag'], name).toBe('noindex, nofollow')
      expect((await request.get('/healthz')).status(), `/healthz после: ${name}`).toBe(200)
    }
  })
})
