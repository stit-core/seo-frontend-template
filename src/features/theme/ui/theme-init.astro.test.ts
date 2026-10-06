import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { Browser } from 'happy-dom'
import ThemeInit from './theme-init.astro'

// Отдельного файла в dist у острова нет — он инлайнится в <head> каждой страницы. Поэтому
// его бюджет ровно один: байты отрендеренного <script>. Внутри HTML-документа их же считает
// бюджет «HTML главной» в .size-limit.cjs.
const INLINE_BUDGET_BYTES = 500
const YEAR_MS = 365 * 24 * 60 * 60 * 1000

const island = await (await AstroContainer.create()).renderToString(ThemeInit)

const browsers: Browser[] = []
afterEach(async () => {
  await Promise.all(browsers.splice(0).map((browser) => browser.close()))
})

// Остров исполняется в happy-dom как в браузере: системная тема и cookie прошлого визита —
// входы, data-* на <html> и cookie выбора — выход.
function open({ system = 'light', cookie }: { system?: 'light' | 'dark'; cookie?: string } = {}) {
  const browser = new Browser({
    settings: {
      // Исполняется только инлайн-скрипт острова из этого репозитория.
      enableJavaScriptEvaluation: true,
      suppressInsecureJavaScriptEnvironmentWarning: true,
      device: { prefersColorScheme: system },
    },
  })
  browsers.push(browser)
  const page = browser.newPage()
  page.url = 'https://demo.example/blog/zapis'
  if (cookie) page.mainFrame.document.cookie = cookie
  page.content = `<!doctype html><html><head>${island}</head><body><main>Текст</main><button type="button" data-theme-toggle><svg></svg></button></body></html>`
  const { document } = page.mainFrame
  const click = (selector: string) =>
    document
      .querySelector(selector)
      ?.dispatchEvent(new page.mainFrame.window.MouseEvent('click', { bubbles: true }))
  return {
    dataset: () => ({ ...document.documentElement.dataset }),
    // Клик приходит на иконку внутри кнопки — как от человека.
    toggle: () => click('[data-theme-toggle] svg'),
    click,
    cookies: () => browser.defaultContext.cookieContainer.getCookies(new URL(page.url), true),
  }
}

describe('ThemeInit', () => {
  it('один инлайн-скрипт без загрузки, комментариев и прагм — в пределах бюджета', () => {
    const scripts = island.match(/<script[^>]*>[\s\S]*?<\/script>/g) ?? []
    expect(scripts).toHaveLength(1)
    const [script = ''] = scripts
    expect(script).not.toContain('src=')
    // Комментарии и прагмы линтеров живут во frontmatter: в <head> уезжает только код.
    expect(script).not.toContain('biome-ignore')
    expect(script).not.toContain('//')
    expect(Buffer.byteLength(script, 'utf8')).toBeLessThanOrEqual(INLINE_BUDGET_BYTES)
  })

  it('без выбора тема системная: схемы на <html> нет, признак JS есть', () => {
    expect(open().dataset()).toEqual({ js: 'on' })
  })

  it('выбор прошлого визита из cookie применяется до отрисовки', () => {
    expect(open({ cookie: 'scheme=dark' }).dataset()).toEqual({ js: 'on', scheme: 'dark' })
  })

  it.each([
    ['light', 'dark'],
    ['dark', 'light'],
  ] as const)(
    'системная %s: переключатель выбирает %s и запоминает её для всего сайта на год',
    (system, chosen) => {
      const page = open({ system })
      page.toggle()
      expect(page.dataset().scheme).toBe(chosen)
      const [cookie] = page.cookies()
      expect(cookie).toMatchObject({ key: 'scheme', value: chosen, path: '/', secure: true })
      expect((cookie?.expires?.getTime() ?? 0) - Date.now()).toBeGreaterThan(YEAR_MS - 60_000)
      page.toggle()
      expect(page.dataset().scheme).toBe(system)
    },
  )

  it('клик мимо переключателя тему не трогает', () => {
    const page = open()
    page.click('main')
    expect(page.dataset()).toEqual({ js: 'on' })
    expect(page.cookies()).toEqual([])
  })
})
