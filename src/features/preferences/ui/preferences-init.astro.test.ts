import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { Browser } from 'happy-dom'
import { cspHash, ISLANDS } from '../../../../scripts/lib/site-policy.mjs'
import MotionToggle from './motion-toggle.astro'
import PreferencesInit from './preferences-init.astro'
import ThemeToggle from './theme-toggle.astro'

// Отдельного файла в dist у острова нет — он инлайнится в <head> каждой страницы. Поэтому
// его бюджет ровно один: байты отрендеренного <script>. Внутри HTML-документа их же считает
// бюджет «HTML главной» в .size-limit.cjs.
const INLINE_BUDGET_BYTES = 1300

const container = await AstroContainer.create()
const island = await container.renderToString(PreferencesInit)
// Кнопки — как их печатают компоненты: договор острова с разметкой проверяется на ней самой.
const controls = [
  await container.renderToString(ThemeToggle, { props: { locale: 'ru' } }),
  await container.renderToString(MotionToggle, { props: { locale: 'ru' } }),
].join('')

type Theme = 'light' | 'dark'
type Motion = '' | 'reduced' | 'full'

const browsers: Browser[] = []
afterEach(async () => {
  await Promise.all(browsers.splice(0).map((browser) => browser.close()))
})

// Остров исполняется в happy-dom как в браузере. Входы — настройки системы, хранилище прошлого
// визита и тема из разметки; выходы — атрибуты ДС на <html>, объявленное состояние кнопок,
// хранилище и видео-петля страницы.
function open({
  system = 'light',
  reduce = false,
  stored = {},
  preset,
  storage = true,
}: {
  system?: Theme
  reduce?: boolean
  stored?: Record<string, string>
  preset?: Theme
  storage?: boolean
} = {}) {
  const browser = new Browser({
    settings: {
      // Исполняется только инлайн-скрипт острова из этого репозитория.
      enableJavaScriptEvaluation: true,
      suppressInsecureJavaScriptEnvironmentWarning: true,
      device: {
        prefersColorScheme: system,
        prefersReducedMotion: reduce ? 'reduce' : 'no-preference',
      },
    },
  })
  browsers.push(browser)
  const page = browser.newPage()
  page.url = 'https://demo.example/blog/zapis'
  const { window } = page.mainFrame
  if (storage) {
    for (const [key, value] of Object.entries(stored)) window.localStorage.setItem(key, value)
  } else {
    // Хранилище закрыто настройкой браузера: обращение к нему бросает.
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('SecurityError')
      },
    })
  }
  const paused = vi.spyOn(window.HTMLMediaElement.prototype, 'pause')
  const root = preset ? `<html data-theme="${preset}">` : '<html>'
  page.content = `<!doctype html>${root}<head>${island}</head><body><main>Текст</main>${controls}<video loop muted></video></body></html>`
  const { document } = page.mainFrame
  const click = (selector: string) =>
    document
      .querySelector(selector)
      ?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  const pressed = (selector: string) =>
    [...document.querySelectorAll(selector)].map((button) => button.getAttribute('aria-pressed'))
  const video = document.querySelector('video')
  return {
    // Документ разобран: кнопки и видео страницы острову видны.
    ready: () => page.waitUntilComplete(),
    dataset: () => ({ ...document.documentElement.dataset }),
    // Клик приходит на иконку внутри кнопки — как от человека.
    toggleTheme: () => click('[data-preference="theme"] svg'),
    chooseMotion: (value: Motion) => click(`[data-preference="motion"][value="${value}"]`),
    click,
    darkPressed: () => pressed('[data-preference="theme"]'),
    // Значения нажатых кнопок движения: у объявленного состояния она ровно одна.
    motionPressed: () =>
      [...document.querySelectorAll('[data-preference="motion"][aria-pressed="true"]')].map(
        (button) => button.getAttribute('value'),
      ),
    undeclared: () => document.querySelectorAll('[data-preference]:not([aria-pressed])').length,
    stored: () =>
      Object.fromEntries(
        ['theme', 'motion'].flatMap((key) => {
          const value = window.localStorage.getItem(key)
          return value === null ? [] : [[key, value]]
        }),
      ),
    // Петля идёт, как после автозапуска браузера.
    play: () => video?.play(),
    playing: () => video?.paused === false,
    pausedOnLoad: () => paused.mock.calls.length > 0,
    // Настройка системы меняется на открытой странице.
    system: (device: { prefersColorScheme?: Theme; prefersReducedMotion?: string }) => {
      Object.assign(browser.settings.device, device)
      window.dispatchEvent(new window.Event('resize'))
    },
    // Страница возвращается из кеша переходов «назад — вперёд»: скрипты заново не исполняются.
    restore: (choice: Record<string, string>) => {
      for (const [key, value] of Object.entries(choice)) window.localStorage.setItem(key, value)
      const event = new window.Event('pageshow')
      Object.defineProperty(event, 'persisted', { value: true })
      window.dispatchEvent(event)
    },
  }
}

describe('PreferencesInit', () => {
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

  // CSP пропускает остров по хешу из политики: правка тела без новой строки политики — красный
  // тест, а не выбор, молча заблокированный браузером.
  it('тело острова — хеш из политики', () => {
    const body = /<script[^>]*>([\s\S]*?)<\/script>/.exec(island)?.[1] ?? ''
    expect(cspHash(body)).toBe(ISLANDS.preferences.hash)
  })

  it.each([
    ['light', false],
    ['dark', true],
  ] as const)(
    'без выбора тема и движение — по системе (%s): атрибутов на <html> нет, состояние кнопок объявлено',
    async (system, dark) => {
      const page = open({ system, reduce: dark })
      await page.ready()
      expect(page.dataset()).toEqual({})
      expect(page.darkPressed()).toEqual([String(dark)])
      expect(page.motionPressed()).toEqual([''])
      expect(page.undeclared()).toBe(0)
    },
  )

  // До первой отрисовки: атрибуты стоят, едва скрипт из <head> отработал, — ни кадра, ни события
  // загрузки тест не ждёт.
  it('выбор прошлого визита встаёт атрибутами ДС до первой отрисовки', async () => {
    const page = open({ stored: { theme: 'dark', motion: 'reduced' } })
    expect(page.dataset()).toEqual({ theme: 'dark', motion: 'reduced' })
    await page.ready()
    expect(page.darkPressed()).toEqual(['true'])
    expect(page.motionPressed()).toEqual(['reduced'])
  })

  it('значение хранилища не из словаря ДС на <html> не попадает', () => {
    const page = open({ stored: { theme: 'sepia', motion: 'fast' } })
    expect(page.dataset()).toEqual({})
  })

  it.each([
    ['light', 'dark'],
    ['dark', 'light'],
  ] as const)(
    'системная %s: кнопка темы включает %s, объявляет состояние и запоминает выбор',
    (system, chosen) => {
      const page = open({ system })
      page.toggleTheme()
      expect(page.dataset()).toEqual({ theme: chosen })
      expect(page.darkPressed()).toEqual([String(chosen === 'dark')])
      expect(page.stored()).toEqual({ theme: chosen })
      page.toggleTheme()
      expect(page.dataset()).toEqual({ theme: system })
      expect(page.darkPressed()).toEqual([String(system === 'dark')])
      expect(page.stored()).toEqual({ theme: system })
    },
  )

  it('выбор действует на следующей странице сайта: её остров читает то же хранилище', () => {
    const first = open()
    first.toggleTheme()
    first.chooseMotion('reduced')
    const next = open({ stored: first.stored() })
    expect(next.dataset()).toEqual({ theme: 'dark', motion: 'reduced' })
  })

  it('тема по умолчанию из разметки: кнопка выбирает противоположную ей, а не системной', async () => {
    const page = open({ system: 'light', preset: 'dark' })
    await page.ready()
    expect(page.dataset()).toEqual({ theme: 'dark' })
    expect(page.darkPressed()).toEqual(['true'])
    page.toggleTheme()
    expect(page.dataset()).toEqual({ theme: 'light' })
  })

  it('движение — три состояния: «Меньше» и «Полное» ставят data-motion, «Как в системе» снимает', () => {
    const page = open()
    page.chooseMotion('reduced')
    expect(page.dataset()).toEqual({ motion: 'reduced' })
    expect(page.motionPressed()).toEqual(['reduced'])
    expect(page.stored()).toEqual({ motion: 'reduced' })
    page.chooseMotion('full')
    expect(page.dataset()).toEqual({ motion: 'full' })
    expect(page.motionPressed()).toEqual(['full'])
    expect(page.stored()).toEqual({ motion: 'full' })
    page.chooseMotion('')
    expect(page.dataset()).toEqual({})
    expect(page.motionPressed()).toEqual([''])
    expect(page.stored()).toEqual({})
  })

  it('«Меньше» останавливает видео-петлю, возврат движения запускает её снова', async () => {
    const page = open()
    await page.play()
    page.toggleTheme()
    expect(page.playing()).toBe(true)
    page.chooseMotion('reduced')
    expect(page.playing()).toBe(false)
    // Смена темы остановленную петлю не запускает: движение по-прежнему «Меньше».
    page.toggleTheme()
    expect(page.playing()).toBe(false)
    page.chooseMotion('')
    expect(page.playing()).toBe(true)
  })

  it.each([
    ['сохранённое «Меньше»', { stored: { motion: 'reduced' } }, true],
    ['настройка системы без выбора', { reduce: true }, true],
    ['«Полное» вопреки системе', { reduce: true, stored: { motion: 'full' } }, false],
    ['движение разрешено', {}, false],
  ] as const)('%s — видео-петля с загрузки страницы', async (_, visit, stopped) => {
    const page = open(visit)
    await page.ready()
    expect(page.pausedOnLoad()).toBe(stopped)
  })

  it('настройка системы сменилась на открытой странице: без выбора состояние следует за ней', async () => {
    const page = open()
    await page.ready()
    await page.play()
    page.system({ prefersColorScheme: 'dark', prefersReducedMotion: 'reduce' })
    expect(page.darkPressed()).toEqual(['true'])
    expect(page.playing()).toBe(false)
    expect(page.dataset()).toEqual({})

    const chosen = open({ stored: { theme: 'light', motion: 'full' } })
    await chosen.ready()
    await chosen.play()
    chosen.system({ prefersColorScheme: 'dark', prefersReducedMotion: 'reduce' })
    expect(chosen.darkPressed()).toEqual(['false'])
    expect(chosen.playing()).toBe(true)
  })

  it('страница из кеша переходов «назад» берёт выбор, сделанный после неё', () => {
    const page = open()
    page.restore({ theme: 'dark', motion: 'reduced' })
    expect(page.dataset()).toEqual({ theme: 'dark', motion: 'reduced' })
    expect(page.darkPressed()).toEqual(['true'])
    expect(page.motionPressed()).toEqual(['reduced'])
  })

  it('хранилище закрыто: выбор действует на странице, состояние кнопок объявлено', async () => {
    const page = open({ storage: false })
    await page.ready()
    expect(page.undeclared()).toBe(0)
    page.toggleTheme()
    page.chooseMotion('reduced')
    expect(page.dataset()).toEqual({ theme: 'dark', motion: 'reduced' })
    expect(page.darkPressed()).toEqual(['true'])
    expect(page.motionPressed()).toEqual(['reduced'])
  })

  it('клик мимо кнопок ничего не трогает', () => {
    const page = open()
    page.click('main')
    expect(page.dataset()).toEqual({})
    expect(page.stored()).toEqual({})
  })
})
