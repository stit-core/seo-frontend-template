import { expect, test } from '@playwright/test'

const ORIGIN = 'http://127.0.0.1:3204'

test.describe('сырой HTML (как его видит бот)', () => {
  test('главная: h1, canonical, hreflang, JSON-LD — в первом байте', async ({ request }) => {
    const res = await request.get('/')
    expect(res.status()).toBe(200)
    const html = await res.text()
    expect(html).toMatch(/<h1[^>]*>/i)
    expect(html).toContain(`<link rel="canonical" href="${ORIGIN}"`)
    expect(html.toLowerCase()).toContain(`hreflang="x-default"`)
    expect(html).toContain('application/ld+json')
    expect(html).toContain('<html lang="ru"')
  })

  test('пост: Article JSON-LD, og:image абсолютный, lastmod', async ({ request }) => {
    const html = await (await request.get('/blog/ssr-i-indeksatsiya')).text()
    expect(html).toContain('"@type":"Article"')
    expect(html).toMatch(/property="og:image" content="https?:\/\//)
    expect(html).toMatch(/<time dateTime="\d{4}-\d{2}-\d{2}"/)
  })

  test('en-зеркало: html lang=en и self-canonical внутри локали', async ({ request }) => {
    const html = await (await request.get('/en/about')).text()
    expect(html).toContain('<html lang="en"')
    expect(html).toContain(`<link rel="canonical" href="${ORIGIN}/en/about"`)
  })
})

test.describe('статусы и нормализация', () => {
  const cases: Array<[string, number]> = [
    ['/old', 301],
    ['/about/', 308],
    ['/ru/blog', 301],
    ['/xx/about', 404],
    ['/blog/net-takogo', 404],
    ['/healthz', 200],
  ]
  for (const [path, code] of cases) {
    test(`${path} → ${code}`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 })
      expect(res.status()).toBe(code)
    })
  }

  test('404 несёт разметку и noindex-осмысленный ответ', async ({ request }) => {
    const res = await request.get('/blog/net-takogo')
    expect(res.status()).toBe(404)
    const html = await res.text()
    expect(html).toContain('404')
    expect(html).toMatch(/<h1[^>]*>/i)
  })
})

test.describe('robots / sitemap / rss', () => {
  test('robots.txt отдаёт sitemap текущего origin', async ({ request }) => {
    const txt = await (await request.get('/robots.txt')).text()
    expect(txt).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`)
  })

  test('sitemap содержит только свой origin и hreflang', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text()
    expect(xml).toContain(`<loc>${ORIGIN}</loc>`)
    expect(xml).toContain('hreflang="x-default"')
    expect(xml).not.toContain('changefreq')
    for (const loc of xml.match(/<loc>([^<]+)<\/loc>/g) ?? []) {
      expect(loc).toContain(ORIGIN)
    }
  })

  test('rss отдаёт абсолютные ссылки', async ({ request }) => {
    const xml = await (await request.get('/rss.xml')).text()
    expect(xml).toContain(`<link>${ORIGIN}</link>`)
  })
})

test.describe('без JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('главная читается: h1 и текст первого поста', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('article').first()).toBeVisible()
  })

  test('навигация по ссылкам работает', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Блог', exact: true }).first().click()
    await expect(page).toHaveURL(/\/blog$/)
  })

  test('форма отправляется нативным POST и делает PRG', async ({ page }) => {
    await page.goto('/contact')
    await page.locator('input[name="name"]').fill('Иван')
    await page.locator('input[name="email"]').fill('ivan@example.org')
    await page.locator('textarea[name="message"]').fill('Сообщение длиннее десяти символов')
    await page.locator('button[type=submit]').click()
    await expect(page).toHaveURL(/\/contact\/thanks$/)
    await expect(page.getByTestId('contact-result')).toBeVisible()
  })

  test('honeypot уводит на «спасибо» молча', async ({ page }) => {
    await page.goto('/contact')
    await page.locator('input[name="website"]').fill('http://spam')
    await page.locator('input[name="name"]').fill('x')
    await page.locator('button[type=submit]').click()
    await expect(page).toHaveURL(/\/contact\/thanks$/)
  })
})

test.describe('с JavaScript', () => {
  test('форма отправляется без перезагрузки и приходит на «спасибо»', async ({ page }) => {
    await page.goto('/contact')
    await page.locator('input[name="name"]').fill('Иван')
    await page.locator('input[name="email"]').fill('ivan@example.org')
    await page.locator('textarea[name="message"]').fill('Сообщение длиннее десяти символов')
    await page.waitForTimeout(2100) // time-trap: поле openedAt проставил клиент
    await page.locator('button[type=submit]').click()
    await expect(page.getByTestId('contact-result')).toBeVisible()
  })

  test('time-trap ловит мгновенную отправку', async ({ page }) => {
    await page.goto('/contact')
    await page.locator('input[name="name"]').fill('Иван')
    await page.locator('input[name="email"]').fill('ivan@example.org')
    await page.locator('textarea[name="message"]').fill('Сообщение длиннее десяти символов')
    // Заполнение полей само по себе может занять > MIN_FILL_MS — переставляем
    // метку открытия на «сейчас», чтобы тест не зависел от скорости машины.
    await page.evaluate(() => {
      const field = document.querySelector<HTMLInputElement>('input[name="openedAt"]')
      if (field) field.value = String(Date.now())
    })
    await page.locator('button[type=submit]').click()
    await expect(page.getByRole('alert')).toBeVisible()
  })
})

test.describe('Googlebot', () => {
  test.use({
    userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  })

  test('пост отдаётся целиком без плейсхолдеров', async ({ request }) => {
    const html = await (
      await request.get('/blog/ssr-i-indeksatsiya', {
        headers: { 'user-agent': 'Googlebot/2.1' },
      })
    ).text()
    expect(html).toContain('<h1')
    expect(html).toContain('</article>')
    expect(html.length).toBeGreaterThan(5000)
  })
})
