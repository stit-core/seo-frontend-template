import { existsSync, mkdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { extname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import tailwindcss from '@tailwindcss/vite'
import type * as Astro from 'astro'
import { ISLANDS, type Island } from '../../src/shared/config/islands.ts'
import { METRIKA_ID } from '../../src/shared/config/site.ts'
import { t } from '../../src/shared/i18n/dict.ts'
import { DEFAULT_LOCALE } from '../../src/shared/i18n/locale.ts'
import { pageTemplates } from '../site'
import { expect, test } from './csp'
import { SITE_THEMES } from './themes'

// Сборка шаблона счётчика не печатает (METRIKA_ID пуст): страницы с ним собирает мини-проект на настоящих
// компонентах — острове согласия, баннере и стилях сайта, — а сервер отдаёт их с CSP из строки счётчика реестра:
// остров исполняется по хешу тела, счётчик грузится с origin его `sources`. Запросы к счётчику перехватывает тест:
// важно, ушёл ли запрос, а не что ответил счётчик.
const repo = resolve(import.meta.dirname, '../..')
const COUNTER = '12345678'
const TAG = 'https://mc.yandex.ru/metrika/tag.js'
const PAGE = `---
import '${repo}/src/app/styles/index.css'
import ConsentBanner from '${repo}/src/app/analytics/consent-banner.astro'
import Metrika from '${repo}/src/app/analytics/metrika.astro'
---
<html lang="${DEFAULT_LOCALE}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Согласие на счётчик</title>
    <Metrika counter="${COUNTER}" />
  </head>
  <body>
    <ConsentBanner locale="${DEFAULT_LOCALE}" policy={{ href: '/legal/privacy' }} />
    <a href="#main">${t(DEFAULT_LOCALE, 'nav.skip')}</a>
    <main id="main">
      <h1>Согласие на счётчик</h1>
      <p><a href="/vtoraya">Вторая страница</a></p>
    </main>
  </body>
</html>
`
const counter: Island = ISLANDS.metrika
const allow = (directive: string) => ["'self'", ...(counter.sources?.[directive] ?? [])].join(' ')
const CSP = [
  "default-src 'self'",
  `script-src ${allow('script-src')} '${counter.hash}'`,
  `connect-src ${allow('connect-src')}`,
  `img-src ${allow('img-src')}`,
].join('; ')
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.css': 'text/css' }

let server: Server | undefined
let site = ''
test.describe.configure({ mode: 'default' })

test.beforeAll(async () => {
  test.setTimeout(90_000)
  const { project, workerIndex } = test.info()
  // Мини-проект — в выходе прогона: Astro кладёт промежуточную сборку в рабочий каталог процесса, если выход проекта
  // вне его, и параллельные сборки воркеров столкнулись бы там.
  const root = join(project.outputDir, 'consent', `${project.name}-${workerIndex}`)
  mkdirSync(join(root, 'src/pages'), { recursive: true })
  symlinkSync(join(repo, 'node_modules'), join(root, 'node_modules'))
  writeFileSync(join(root, 'src/pages/index.astro'), PAGE)
  writeFileSync(join(root, 'src/pages/vtoraya.astro'), PAGE)
  // `astro` в тестах — модуль типов: сборщик берётся из файла пакета.
  const { build } = (await import(
    pathToFileURL(join(repo, 'node_modules/astro/dist/core/index.js')).href
  )) as typeof Astro
  // Стили — файлом, как у сайта: инлайн-стиль CSP страницы не пропускает. Секция ширины берёт `sizes` из модуля
  // сборки сайта — мини-проекту он не нужен.
  await build({
    root,
    logLevel: 'silent',
    cacheDir: join(root, '.cache'),
    build: { inlineStylesheets: 'never' },
    vite: {
      cacheDir: join(root, '.vite'),
      resolve: { alias: { '@': join(repo, 'src') } },
      build: { assetsInlineLimit: 0 },
      plugins: [
        tailwindcss(),
        {
          name: 'slot-sizes',
          resolveId: (id: string) => (id === 'virtual:slot-sizes' ? '\0virtual:slot-sizes' : null),
          load: (id: string) => (id === '\0virtual:slot-sizes' ? 'export default {}' : null),
        },
      ],
    },
  })
  const dist = join(root, 'dist')
  server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://x').pathname
    const file = [join(dist, path), join(dist, path, 'index.html')].find(
      (candidate) =>
        candidate.startsWith(dist) && existsSync(candidate) && statSync(candidate).isFile(),
    )
    response.writeHead(file ? 200 : 404, {
      'content-type': (file && TYPES[extname(file)]) ?? 'text/plain',
      'content-security-policy': CSP,
    })
    response.end(file ? readFileSync(file) : null)
  })
  await new Promise<void>((done) => server?.listen(0, '127.0.0.1', done))
  site = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

test.afterAll(() => {
  server?.close()
})

// Запросы страницы к счётчику — любой адрес его origin: загрузчик, хиты, пиксель. Ответ — пустой загрузчик.
async function counterRequests(page: Page) {
  const seen: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).hostname === 'mc.yandex.ru') seen.push(request.url())
  })
  await page.route('https://mc.yandex.ru/**', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: '' }),
  )
  return seen
}

// Страница загружена, и браузер простаивает: согласный счётчик к этому моменту уже запрошен — его загрузчик ждёт того
// же простоя.
const idle = (page: Page) =>
  page.evaluate(() => new Promise((done) => requestIdleCallback(() => done(null))))

const bannerOf = (page: Page) =>
  page.getByRole('region', { name: t(DEFAULT_LOCALE, 'consent.label') })
const choice = (page: Page, key: 'consent.accept' | 'consent.reject') =>
  bannerOf(page).getByRole('button', { name: t(DEFAULT_LOCALE, key) })

test('до выбора — баннер и ни одного запроса к счётчику; «Принять» — счётчик, на следующей странице — без вопроса', async ({
  page,
}) => {
  const requests = await counterRequests(page)
  await page.goto(site)
  await expect(bannerOf(page)).toBeVisible()
  await idle(page)
  expect(requests).toEqual([])
  expect(await page.evaluate(() => 'ym' in window)).toBe(false)

  const loader = page.waitForRequest(TAG)
  await choice(page, 'consent.accept').click()
  await loader
  await expect(bannerOf(page)).toBeHidden()
  expect(await page.evaluate(() => (window as { ym?: { a?: unknown } }).ym?.a)).toEqual([
    [COUNTER, 'init'],
  ])

  // Повтор визита: выбор сделан — баннера нет, счётчик грузится сам.
  const next = page.waitForRequest(TAG)
  await page.goto(`${site}/vtoraya`)
  await next
  await expect(page.locator('[data-consent-banner]')).toBeHidden()
})

test('«Отклонить» — ни одного запроса к счётчику, баннер не возвращается ни на следующей странице, ни после перезагрузки', async ({
  page,
}) => {
  const requests = await counterRequests(page)
  await page.goto(site)
  await choice(page, 'consent.reject').click()
  await expect(bannerOf(page)).toBeHidden()
  for (const visit of [() => page.goto(`${site}/vtoraya`), () => page.reload()]) {
    await visit()
    await idle(page)
    await expect(page.locator('[data-consent-banner]')).toBeHidden()
  }
  expect(requests).toEqual([])
})

// Без скрипта выбор не сохранить и счётчик не включить: баннера, который ничего не меняет, нет.
test.describe('скрипта нет', () => {
  test.use({ javaScriptEnabled: false })

  test('ни баннера, ни запросов к счётчику', async ({ page }) => {
    const requests = await counterRequests(page)
    await page.goto(site, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-consent-banner]')).toBeHidden()
    expect(requests).toEqual([])
  })
})

// Баннер — первым в <body>: Tab встречает его раньше страницы, выбор делается клавиатурой, а дальше фокус идёт по
// порядку — к переходу к содержимому.
test('клавиатура: цели баннера — первые, фокус виден, после выбора — переход к содержимому', async ({
  page,
}) => {
  await page.goto(site)
  const policy = bannerOf(page).getByRole('link', { name: t(DEFAULT_LOCALE, 'consent.policy') })
  for (const target of [policy, choice(page, 'consent.accept'), choice(page, 'consent.reject')]) {
    await page.keyboard.press('Tab')
    await expect(target).toBeFocused()
    expect(await target.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe(
      'none',
    )
  }
  await page.keyboard.press('Enter')
  await expect(bannerOf(page)).toBeHidden()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: t(DEFAULT_LOCALE, 'nav.skip') })).toBeFocused()
})

// WCAG 2.2 AA целиком: без тегов axe не запускает, например, target-size (2.5.8).
const RULES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']

for (const theme of SITE_THEMES) {
  test.describe(`тема ${theme}`, () => {
    test.use({ colorScheme: theme })

    test('открытый баннер — без нарушений axe', async ({ page }) => {
      await page.goto(site)
      // Тема выбором — атрибут ДС, как у острова предпочтений: блок темы файла токенов, а не только система.
      await page.evaluate((chosen) => {
        document.documentElement.dataset.theme = chosen
      }, theme)
      await expect(bannerOf(page)).toBeVisible()
      expect((await new AxeBuilder({ page }).withTags(RULES).analyze()).violations).toEqual([])
    })
  })
}

// Норма блока cookie-banner каталога: на телефоне — не больше 25–30 % высоты экрана, призыв первого экрана виден.
test.describe('телефон', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  test('баннер компактный: не выше 30 % экрана, без вылета вбок', async ({ page }) => {
    await page.goto(site)
    const box = await bannerOf(page).boundingBox()
    expect(box?.height).toBeLessThanOrEqual(844 * 0.3)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })
})

// Сайт сборки: без идентификатора счётчика нет ни баннера, ни острова; с ним — баннер на каждой странице, и до выбора
// ни одного запроса к счётчику.
test('страницы сайта: баннер — только при METRIKA_ID, запросов к счётчику до выбора нет', async ({
  page,
}) => {
  const requests = await counterRequests(page)
  for (const path of pageTemplates()) {
    await page.goto(path)
    await idle(page)
    const banner = page.locator('[data-consent-banner]')
    if (METRIKA_ID === '') await expect(banner, path).toHaveCount(0)
    else await expect(banner, path).toBeVisible()
  }
  expect(requests).toEqual([])
})
