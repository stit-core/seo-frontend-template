import { expect, test } from '@playwright/test'
import { onDemandRoutes } from '../site'

// Контур staging (ROBOTS_POLICY=noindex): тот же образ, закрытый приложением. Prerendered до
// приложения не доходит — его закрывает Traefik (basicAuth + X-Robots-Tag), не этот набор.
test.describe('staging: ROBOTS_POLICY=noindex', () => {
  test('robots.txt закрывает сайт целиком и не называет карту', async ({ request }) => {
    const response = await request.get('/robots.txt')
    expect(response.status()).toBe(200)
    expect(await response.text()).toBe('User-agent: *\nDisallow: /\n')
  })

  test('каждый ответ приложения — X-Robots-Tag: noindex, nofollow', async ({ request }) => {
    for (const path of [...onDemandRoutes(), '/net-takogo-adresa']) {
      const response = await request.get(path, { maxRedirects: 0 })
      expect(response.headers()['x-robots-tag'], path).toBe('noindex, nofollow')
    }
  })
})
