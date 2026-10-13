import { join } from 'node:path'
import type { Page, TestInfo } from '@playwright/test'
import { t } from '../../src/shared/i18n/dict.ts'
import { localePath, SUPPORTED_LOCALES } from '../../src/shared/i18n/locale.ts'
import { pageTemplates } from '../site'
import { expect, test } from './csp'
import { SITE_THEMES } from './themes'

// Раскладка шаблона страницы в настоящем браузере — геометрия и факты, а не снапшоты: по странице сборки
// на prerendered-маршрут, служебные on-demand (/now, 404 каждой локали) и ответ формы с ошибками. Проект
// задаёт профиль: телефон (касание) или десктоп (мышь). Кадры страниц — файлы для взгляда глазами в
// test-results/frames/<профиль>/.
const notFound = SUPPORTED_LOCALES.map((locale) => localePath(locale, '/net-takogo-adresa'))
const PAGES = [...pageTemplates(), '/now', ...notFound]

// Цель касания на телефоне — не меньше 44 px по обеим сторонам: умолчание программы (WCAG 2.5.5).
const TOUCH_MIN = 44

// Факты раскладки в окне браузера.
// - вылет: ширина документа сверх окна;
// - геометрия: ширину, фон и ритм задают секции — каждый ребёнок <main> на всё окно, контейнер по центру
//   своей полосы, у каркаса (шапка, подвал) — роль страницы, у тела записи — колонка чтения, у секции —
//   роль ширины или всё окно; роль браузер читает утилитой слоя на пробном элементе;
// - разорванные слова заголовков: слово рвётся (overflow-wrap: anywhere), только когда не помещается в
//   строку, а заголовку при обычном кегле до этого не доходит;
// - цели: что посетитель видит и нажимает, кроме ссылки внутри предложения (исключение WCAG 2.5.8: в её
//   блоке есть слова вне неё, размер задаёт строка текста), — бокс, высота её текста и заливка.
function layout() {
  const root = document.documentElement
  const width = root.clientWidth
  const name = (element: Element) =>
    `${element.tagName.toLowerCase()} «${(element.textContent ?? '').trim().slice(0, 30) || element.id}»`

  const role = (utility: string) => {
    const probe = document.createElement('div')
    probe.className = utility
    document.body.append(probe)
    const value = getComputedStyle(probe).maxWidth
    probe.remove()
    return value
  }
  const reading = role('max-w-measure')
  const page = role('max-w-container')
  const roles = new Set([reading, page, role('max-w-container-wide'), 'none'])
  const geometry: string[] = []
  for (const child of document.querySelector('main')?.children ?? []) {
    const box = child.getBoundingClientRect()
    if (Math.abs(box.left) > 0.5 || Math.abs(box.width - width) > 0.5) {
      geometry.push(`${name(child)} — ${box.left}…${box.right} px, а окно — 0…${width}`)
    }
  }
  const frame = [...document.querySelectorAll('body > header > div, body > footer > div')]
  const sections = [...document.querySelectorAll('main > section > div')]
  for (const container of [...frame, ...sections]) {
    const outer = container.parentElement?.getBoundingClientRect()
    const box = container.getBoundingClientRect()
    if (outer && Math.abs(box.left - outer.left - (outer.right - box.right)) > 1) {
      geometry.push(`контейнер ${name(container)} не по центру: ${box.left}…${box.right} px`)
    }
  }
  for (const container of frame) {
    const value = getComputedStyle(container).maxWidth
    if (value !== page)
      geometry.push(`каркас ${name(container)}: ${value}, роль страницы — ${page}`)
  }
  for (const container of sections) {
    const value = getComputedStyle(container).maxWidth
    if (!roles.has(value)) geometry.push(`секция ${name(container)}: ${value} — не роль ширины`)
  }
  for (const prose of document.querySelectorAll('main .prose')) {
    const value = getComputedStyle(prose.closest('main > section > div') ?? prose).maxWidth
    if (value !== reading) geometry.push(`тело записи: ${value}, колонка чтения — ${reading}`)
  }

  const broken: string[] = []
  for (const heading of document.querySelectorAll('h1, h2, h3')) {
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (const word of (node.textContent ?? '').matchAll(/[\p{L}\p{N}]+/gu)) {
        const range = document.createRange()
        range.setStart(node, word.index)
        range.setEnd(node, word.index + word[0].length)
        const lines = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)))
        if (lines.size > 1) broken.push(word[0])
      }
    }
  }

  const words = (text: string) => text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0
  const inSentence = (element: Element) => {
    let block = element.parentElement
    while (block && getComputedStyle(block).display.startsWith('inline')) {
      block = block.parentElement
    }
    return words(block?.textContent ?? '') > words(element.textContent ?? '')
  }
  const targets = [
    ...document.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea'),
  ]
    .filter((element) => element.checkVisibility() && !element.closest('[aria-hidden="true"]'))
    .filter((element) => element.tagName !== 'A' || !inSentence(element))
    .map((element) => {
      const box = element.getBoundingClientRect()
      const text = document.createRange()
      text.selectNodeContents(element)
      const style = getComputedStyle(element)
      return {
        name: name(element),
        link: element.tagName === 'A',
        width: box.width,
        height: box.height,
        text: text.getBoundingClientRect().height,
        filled: style.backgroundColor !== 'rgba(0, 0, 0, 0)' || style.borderTopWidth !== '0px',
      }
    })
    .filter((target) => target.width > 1 && target.height > 1)

  return { overflow: root.scrollWidth - width, geometry, broken, targets }
}

type Layout = ReturnType<typeof layout>
type Target = Layout['targets'][number]

// Цель касания — бокс элемента. У мыши размер цели свой: текстовую ссылку правило касания не дотягивает до
// 44 px сверх её текста (бокс с заливкой или рамкой — кнопка, её размер — её).
const small = (target: Target) => target.width < TOUCH_MIN - 0.5 || target.height < TOUCH_MIN - 0.5
const stretched = (target: Target) =>
  target.link && !target.filled && target.height >= TOUCH_MIN - 0.5 && target.text < TOUCH_MIN - 0.5

// Окна профиля в CSS px: телефон — своё и 320; десктоп — своё, зум 200 % и 400 % (окно делится на
// масштаб: вёрстка видит CSS px, плотность пикселей на неё не влияет). Текст 200 % — корень вдвое.
async function inspect(page: Page) {
  const touch = await page.evaluate(() => matchMedia('(pointer: coarse)').matches)
  const own = page.viewportSize() ?? { width: 0, height: 0 }
  const windows = touch
    ? [own, { width: 320, height: 640 }]
    : [1, 2, 4].map((zoom) => ({
        width: own.width / zoom,
        height: own.height / zoom,
      }))
  for (const size of windows) {
    await page.setViewportSize(size)
    const at = `окно ${size.width} px`
    const facts = await page.evaluate(layout)
    expect(facts.overflow, `вылет, ${at}`).toBe(0)
    expect(facts.geometry, `геометрия, ${at}`).toEqual([])
    expect(facts.broken, `слово заголовка разорвано, ${at}`).toEqual([])
    const wrong = facts.targets.filter(touch ? small : stretched).map((target) => target.name)
    expect(
      wrong,
      touch ? `цель касания меньше 44 px, ${at}` : `цель у мыши растянута, ${at}`,
    ).toEqual([])
  }
  for (const size of touch ? windows : [own]) {
    await page.setViewportSize(size)
    await page.evaluate(() => document.documentElement.style.setProperty('font-size', '200%'))
    const { overflow } = await page.evaluate(layout)
    await page.evaluate(() => document.documentElement.style.removeProperty('font-size'))
    expect(overflow, `вылет при тексте 200 %, окно ${size.width} px`).toBe(0)
  }
  await page.setViewportSize(own)
  if (!touch) await expectActionBorders(page)
}

// В режиме высокой контрастности заливки нет: действие с заливкой видно по рамке.
async function expectActionBorders(page: Page) {
  const filled = await page.evaluate(() =>
    [...document.querySelectorAll('a[href], button')].flatMap((element, index) =>
      getComputedStyle(element).backgroundColor !== 'rgba(0, 0, 0, 0)' ? [index] : [],
    ),
  )
  await page.emulateMedia({ forcedColors: 'active' })
  const borderless = await page.evaluate(
    (indices) =>
      [...document.querySelectorAll('a[href], button')]
        .filter((_, index) => indices.includes(index))
        .filter((element) => {
          const style = getComputedStyle(element)
          return style.borderTopStyle === 'none' || Number.parseFloat(style.borderTopWidth) < 1
        })
        .map((element) => (element.textContent ?? '').trim()),
    filled,
  )
  await page.emulateMedia({ forcedColors: 'none' })
  expect(borderless, 'действие без рамки в forced-colors').toEqual([])
}

// Кадр страницы в каждой теме сайта — для взгляда глазами; тема — атрибутом ДС, как её ставит выбор.
async function frames(page: Page, testInfo: TestInfo, name: string) {
  const initial = await page.evaluate(() => document.documentElement.dataset.theme ?? null)
  for (const theme of SITE_THEMES) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value
    }, theme)
    await page.screenshot({
      path: join(
        testInfo.project.outputDir,
        'frames',
        testInfo.project.name,
        `${name}-${theme}.png`,
      ),
      fullPage: true,
      scale: 'css',
    })
  }
  await page.evaluate((value) => {
    if (value === null) delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = value
  }, initial)
}

const frameName = (path: string) => (path === '/' ? 'home' : path.slice(1).replaceAll('/', '_'))

for (const path of PAGES) {
  test(path, async ({ page }, testInfo) => {
    await page.goto(path)
    await page.evaluate(async () => {
      await document.fonts.ready
    })
    await inspect(page)
    await frames(page, testInfo, frameName(path))
  })
}

test('ответ формы с ошибками', async ({ page }, testInfo) => {
  await page.goto('/contacts')
  // Нативная проверка отключена: ошибки должен вернуть сервер.
  await page.locator('form[method="post"]').evaluate((form: HTMLFormElement) => {
    form.noValidate = true
  })
  await page.getByRole('button', { name: t('ru', 'form.submit') }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await inspect(page)
  await frames(page, testInfo, 'contacts_oshibki')
})

// Главная — не колонка: на ней полоса фона на всё окно и сетка шире колонки чтения.
for (const locale of SUPPORTED_LOCALES) {
  const home = localePath(locale, '/')
  test(`${home}: полоса фона — на всё окно, сетка — шире колонки чтения`, async ({ page }) => {
    await page.goto(home)
    const facts = await page.evaluate(() => {
      const width = document.documentElement.clientWidth
      const canvas = getComputedStyle(document.body).backgroundColor
      const bands = [...document.querySelectorAll('main > section')]
        .filter((section) => {
          const fill = getComputedStyle(section).backgroundColor
          return fill !== canvas && fill !== 'rgba(0, 0, 0, 0)'
        })
        .map((section) => section.getBoundingClientRect().width)
      const probe = document.createElement('div')
      probe.className = 'max-w-measure'
      document.body.append(probe)
      const reading = Number.parseFloat(getComputedStyle(probe).maxWidth)
      probe.remove()
      const wider = [...document.querySelectorAll('main > section > div')].some((container) => {
        const value = getComputedStyle(container).maxWidth
        return value === 'none' || Number.parseFloat(value) > reading
      })
      return { width, bands, wider }
    })
    expect(facts.bands.length, 'полос фона на главной').toBeGreaterThan(0)
    for (const band of facts.bands) expect(band).toBe(facts.width)
    expect(facts.wider, 'секция шире колонки чтения').toBe(true)
  })
}
