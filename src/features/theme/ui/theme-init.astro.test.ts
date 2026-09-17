import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import ThemeInit from './theme-init.astro'

// Отдельного файла в dist у острова нет — он инлайнится в <head> каждой страницы. Поэтому
// его бюджет ровно один: байты отрендеренного <script>. Внутри HTML-документа их же считает
// бюджет «HTML главной» в .size-limit.cjs.
const INLINE_BUDGET_BYTES = 500

describe('ThemeInit', () => {
  it('инлайн-скрипт без загрузки: применяет выбор темы и слушает переключатель', async () => {
    const container = await AstroContainer.create()
    const html = await container.renderToString(ThemeInit)
    const scripts = html.match(/<script[^>]*>[\s\S]*?<\/script>/g) ?? []
    expect(scripts).toHaveLength(1)
    const script = scripts[0] as string
    expect(script).not.toContain('src=')
    expect(script).toContain('documentElement.dataset')
    expect(script).toContain('.cookie')
    expect(script).toContain('data-theme-toggle')
    expect(script).toContain('prefers-color-scheme:dark')
    // Комментарии и прагмы линтеров живут во frontmatter: в <head> уезжает только код.
    expect(script).not.toContain('biome-ignore')
    expect(script).not.toContain('//')
    expect(Buffer.byteLength(script, 'utf8')).toBeLessThanOrEqual(INLINE_BUDGET_BYTES)
  })
})
