import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import type * as Config from '@/shared/config'
import { parseHtml } from '@/shared/lib/testing'
import type * as Policy from '../../../scripts/lib/site-policy.mjs'
import DocumentLayout from './document.astro'

// Поле THEME и страницы острова предпочтений в реестре — решения проекта: тест задаёт их и
// смотрит, что печатает оболочка.
const theme = vi.hoisted(() => ({ default: 'system', switcher: true }))
const preferences = vi.hoisted(() => ({ pages: ['*'] }))
vi.mock('@/shared/config', async (importOriginal) => ({
  ...(await importOriginal<typeof Config>()),
  THEME: theme,
}))
vi.mock('../../../scripts/lib/site-policy.mjs', async (importOriginal) => {
  const policy = await importOriginal<typeof Policy>()
  return { ...policy, ISLANDS: { ...policy.ISLANDS, preferences } }
})

const container = await AstroContainer.create()

async function render(site: typeof theme, { pages = ['*'], path = '/stranica' } = {}) {
  Object.assign(theme, site)
  preferences.pages = pages
  const html = await container.renderToString(DocumentLayout, {
    props: {
      locale: 'ru',
      title: 'Страница для проверки оболочки',
      description: 'Страница существует только в тесте: оболочка печатает её head и каркас сайта.',
    },
    request: new Request(`https://demo.example${path}`),
    partial: false,
    slots: { default: '<h1>Страница</h1>' },
  })
  const document = parseHtml(html)
  return {
    root: document.documentElement,
    main: document.querySelector('main'),
    island: document.head.querySelector('script[data-island="preferences"]'),
    toggle: document.body.querySelector('[data-preference="theme"]'),
    colorScheme: document.querySelector('meta[name="color-scheme"]'),
  }
}

describe('DocumentLayout', () => {
  it('тема по системе: атрибута темы на <html> нет, кнопка выбора есть', async () => {
    const page = await render({ default: 'system', switcher: true })
    expect(page.root.hasAttribute('data-theme')).toBe(false)
    expect(page.toggle).not.toBeNull()
  })

  it('тему по умолчанию ставит атрибут ДС; без кнопки выбора её нет', async () => {
    const page = await render({ default: 'dark', switcher: false })
    expect(page.root.getAttribute('data-theme')).toBe('dark')
    expect(page.toggle).toBeNull()
  })

  // Сайту одной темы остров нужен только там, где страница печатает переключатель движения: её
  // путь встаёт в строку реестра — и оболочка печатает остров на ней под любой локалью.
  it('остров предпочтений стоит на страницах своей строки реестра', async () => {
    const site = { default: 'dark', switcher: false }
    const printed = async (pages: string[], path: string) =>
      (await render(site, { pages, path })).island !== null
    expect(await printed(['*'], '/stranica')).toBe(true)
    expect(await printed([], '/stranica')).toBe(false)
    expect(await printed(['/video'], '/video')).toBe(true)
    expect(await printed(['/video'], '/en/video')).toBe(true)
    expect(await printed(['/video'], '/stranica')).toBe(false)
    expect(await printed(['/kejsy/*'], '/kejsy/dom')).toBe(true)
    expect(await printed(['/kejsy/*'], '/kejsy')).toBe(false)
  })

  // Ширину, фон и отступы странице дают её секции: класс на <main> сузил бы каждую страницу.
  it('оболочка страницу не сужает: у <main> — только место в колонке оболочки', async () => {
    const page = await render({ default: 'system', switcher: true })
    expect(page.main?.className).toBe('flex-1')
  })

  // color-scheme страницы объявляет файл токенов: у ДС с одной темой второй схемы нет.
  it.each([
    { default: 'system', switcher: true },
    { default: 'light', switcher: false },
  ])('своего color-scheme у оболочки нет: тема $default', async (site) => {
    const page = await render(site)
    expect(page.colorScheme).toBeNull()
    expect(page.root.hasAttribute('style')).toBe(false)
  })
})
