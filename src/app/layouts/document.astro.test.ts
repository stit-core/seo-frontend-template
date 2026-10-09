import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import type * as Config from '@/shared/config'
import { parseHtml } from '@/shared/lib/testing'
import DocumentLayout from './document.astro'

// Поле THEME — решение проекта: тест задаёт его и смотрит, что печатает оболочка.
const theme = vi.hoisted(() => ({ default: 'system', switcher: true }))
vi.mock('@/shared/config', async (importOriginal) => ({
  ...(await importOriginal<typeof Config>()),
  THEME: theme,
}))

const container = await AstroContainer.create()

async function render(site: typeof theme) {
  Object.assign(theme, site)
  const html = await container.renderToString(DocumentLayout, {
    props: {
      locale: 'ru',
      title: 'Страница для проверки оболочки',
      description: 'Страница существует только в тесте: оболочка печатает её head и каркас сайта.',
    },
    request: new Request('https://demo.example/stranica'),
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
  it('тема по системе: атрибута темы на <html> нет, кнопка выбора и остров предпочтений есть', async () => {
    const page = await render({ default: 'system', switcher: true })
    expect(page.root.hasAttribute('data-theme')).toBe(false)
    expect(page.island).not.toBeNull()
    expect(page.toggle).not.toBeNull()
  })

  it('тему по умолчанию ставит атрибут ДС; без кнопки выбора нет ни её, ни острова', async () => {
    const page = await render({ default: 'dark', switcher: false })
    expect(page.root.getAttribute('data-theme')).toBe('dark')
    expect(page.island).toBeNull()
    expect(page.toggle).toBeNull()
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
