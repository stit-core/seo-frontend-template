import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { Browser } from 'happy-dom'
import { ISLANDS } from '@/shared/config'
import { parseHtml } from '@/shared/lib/testing'
import { LoopVideo } from '@/shared/ui/media'
import { brotliBytes, cspHash } from '../../../../scripts/lib/site-policy.mjs'
import MotionToggle from './motion-toggle.astro'
import PreferencesInit from './preferences-init.astro'
import ThemeToggle from './theme-toggle.astro'

const container = await AstroContainer.create()
const island = await container.renderToString(PreferencesInit)
const body = /<script[^>]*>([\s\S]*?)<\/script>/.exec(island)?.[1] ?? ''
// Кнопки и петля — как их печатают компоненты: договор острова с разметкой проверяется на ней самой.
const controls = [
  await container.renderToString(ThemeToggle, { props: { locale: 'ru' } }),
  await container.renderToString(MotionToggle, { props: { locale: 'ru' } }),
].join('')
const loop = await container.renderToString(LoopVideo, {
  props: {
    poster: { src: '/_astro/loop.avif', width: 1920, height: 1080, format: 'avif' },
    sources: [
      { src: '/_astro/loop.av1.mp4', type: 'video/mp4; codecs="av01.0.08M.10"' },
      { src: '/_astro/loop.h264.mp4', type: 'video/mp4; codecs="avc1.640032"' },
    ],
  },
})

type Theme = 'light' | 'dark'
type Motion = '' | 'reduced' | 'full'

const browsers: Browser[] = []
const cleanups: Array<() => void> = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) cleanup()
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
  const { prototype } = window.HTMLMediaElement
  // Браузер выбирает источник ролика по `media` при разборе и при load(), а не на каждой смене настройки
  // системы: currentSrc — итог последнего выбора, пустой — источника нет и ролик не качается. Ролик с
  // `preload="none"` качается, когда его запускают: автозапуском разметки — сразу, как выбран источник,
  // или play(). Пауза загрузку не обрывает — её обрывает load(): он ставит ролик на паузу и выбирает
  // источник заново, и без автозапуска ролик ждёт запуска, не качаясь.
  let selected: string | undefined
  let fetching = false
  const select = (video: HTMLMediaElement) =>
    [...video.querySelectorAll('source')].find(
      (source) => source.media === '' || window.matchMedia(source.media).matches,
    )?.src ?? ''
  Object.defineProperty(prototype, 'currentSrc', {
    configurable: true,
    get(this: HTMLMediaElement) {
      if (selected === undefined) {
        selected = select(this)
        fetching = selected !== ''
      }
      return selected
    },
  })
  const reloads = vi.spyOn(prototype, 'load').mockImplementation(function (this: HTMLMediaElement) {
    this.pause()
    selected = select(this)
    fetching = selected !== '' && this.autoplay
  })
  const root = preset ? `<html data-theme="${preset}">` : '<html>'
  page.content = `<!doctype html>${root}<head>${island}</head><body><main>Текст</main>${controls}${loop}</body></html>`
  const { document } = page.mainFrame
  document.addEventListener(
    'play',
    () => {
      fetching ||= Boolean(selected)
    },
    true,
  )
  const click = (selector: string) =>
    document
      .querySelector(selector)
      ?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  const pressed = (selector: string) =>
    [...document.querySelectorAll(selector)].map((button) => button.getAttribute('aria-pressed'))
  const video = document.querySelector('video')
  // Источник выбран при разборе — до любой смены настройки системы.
  void video?.currentSrc
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
    // Браузер отказывает в автозапуске (настройка посетителя, режим экономии). Не шпион: шпион сам
    // подписывается на возвращённый промис, и необработанного отказа уже не было бы.
    refuseAutoplay: () => {
      const { prototype } = window.HTMLMediaElement
      const play = Object.getOwnPropertyDescriptor(prototype, 'play')
      prototype.play = () =>
        Promise.reject(new window.DOMException('автозапуск запрещён', 'NotAllowedError'))
      cleanups.push(() => {
        if (play) Object.defineProperty(prototype, 'play', play)
      })
    },
    playing: () => video?.paused === false,
    fetching: () => fetching,
    // Условия источников петли и ролик, который браузер выбрал по ним последним.
    conditions: () =>
      [...document.querySelectorAll('video source')].map((source) => source.getAttribute('media')),
    source: () => video?.currentSrc,
    reloads: () => reloads.mock.calls.length,
    // Настройка системы меняется на открытой странице.
    system: (device: { prefersColorScheme?: Theme; prefersReducedMotion?: string }) => {
      Object.assign(browser.settings.device, device)
      window.dispatchEvent(new window.Event('resize'))
    },
    // Страница возвращается из кеша переходов «назад — вперёд»: скрипты заново не исполняются, а
    // хранилище с тех пор поменяли на другой странице сайта.
    restore: (stored: Record<string, string>) => {
      window.localStorage.clear()
      for (const [key, value] of Object.entries(stored)) window.localStorage.setItem(key, value)
      const event = new window.Event('pageshow')
      Object.defineProperty(event, 'persisted', { value: true })
      window.dispatchEvent(event)
    },
  }
}

// Документ ещё разбирается: остров исполнен в <head>, кнопки шапки приходят следом. Кадры отрисовки
// тест прокручивает сам.
function parsing() {
  const browser = new Browser({
    settings: {
      enableJavaScriptEvaluation: true,
      suppressInsecureJavaScriptEnvironmentWarning: true,
    },
  })
  browsers.push(browser)
  const page = browser.newPage()
  page.url = 'https://demo.example/'
  page.content = '<!doctype html><html><head></head><body></body></html>'
  const { window, document } = page.mainFrame
  const frames: Array<() => void> = []
  Object.assign(window, {
    requestAnimationFrame: (frame: (time: number) => void) => frames.push(() => frame(0)),
  })
  Object.defineProperty(document, 'readyState', { value: 'loading' })
  const script = document.createElement('script')
  script.textContent = body
  document.head.append(script)
  return {
    parse: (html: string) => document.body.insertAdjacentHTML('beforeend', html),
    frame: () => {
      for (const frame of frames.splice(0)) frame()
    },
    undeclared: () => document.querySelectorAll('[data-preference]:not([aria-pressed])').length,
  }
}

describe('PreferencesInit', () => {
  it('один инлайн-скрипт без загрузки, комментариев и прагм — в бюджете своей строки реестра с запасом', () => {
    const scripts = island.match(/<script[^>]*>[\s\S]*?<\/script>/g) ?? []
    expect(scripts).toHaveLength(1)
    const [script = ''] = scripts
    expect(script).not.toContain('src=')
    // Комментарии и прагмы линтеров живут во frontmatter: в <head> уезжает только код.
    expect(script).not.toContain('biome-ignore')
    expect(script).not.toContain('//')
    // Мера — тег целиком в brotli: так же его взвешивает seo:check на странице сборки. Запас нормы
    // бюджета — 10 %: правка, которая его съела, меняет и бюджет.
    expect(brotliBytes(script) * 1.1).toBeLessThanOrEqual(ISLANDS.preferences.budget)
  })

  // CSP пропускает остров по хешу из политики: правка тела без новой строки политики — красный
  // тест, а не выбор, молча заблокированный браузером.
  it('тело острова — хеш из его строки реестра', () => {
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

  // Сервер выбора не знает, и без острова его не применить и не сохранить: кнопки скрыты классом
  // `hidden`, показывает их только объявленное островом состояние.
  it('без острова кнопки не видны: показ — только по объявленному состоянию', () => {
    const markup = parseHtml(controls)
    const shownBy = (element: { readonly classList: Iterable<string> } | null) => {
      const classes = [...(element?.classList ?? [])]
      const display = /^(?:inline-)?(?:flex|block|grid|table)$|^(?:inline|contents|flow-root)$/
      return classes.includes('hidden')
        ? classes.filter((name) => display.test(name.split(':').at(-1) ?? ''))
        : ['без hidden']
    }
    expect(shownBy(markup.querySelector('[data-preference="theme"]'))).toEqual([
      'aria-[pressed]:inline-flex',
    ])
    expect(shownBy(markup.querySelector('fieldset'))).toEqual(['has-aria-pressed:flex'])
  })

  it.each([
    { theme: 'sepia', motion: 'fast' },
    { theme: ' dark', motion: 'reduced ' },
    { theme: 'darkish', motion: 'fully' },
  ])('значение хранилища не из словаря ДС на <html> не попадает: «$theme», «$motion»', (stored) => {
    expect(open({ stored }).dataset()).toEqual({})
  })

  // На медленной сети шапка видна раньше, чем документ дочитан: кнопка, которую разбор добавил после
  // острова, объявлена к следующему кадру, а не к концу загрузки.
  it('пока документ разбирается, остров объявляет кнопки каждый кадр', () => {
    const page = parsing()
    page.parse(controls)
    expect(page.undeclared()).toBeGreaterThan(0)
    page.frame()
    expect(page.undeclared()).toBe(0)
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

  it('«Меньше» останавливает видео-петлю и обрывает её загрузку, возврат движения запускает её снова', async () => {
    const page = open()
    await page.play()
    page.toggleTheme()
    expect(page.playing()).toBe(true)
    page.chooseMotion('reduced')
    expect(page.playing()).toBe(false)
    expect(page.fetching()).toBe(false)
    // Смена темы остановленную петлю не запускает: движение по-прежнему «Меньше».
    page.toggleTheme()
    expect(page.playing()).toBe(false)
    page.chooseMotion('')
    expect(page.playing()).toBe(true)
    expect(page.fetching()).toBe(true)
  })

  // Автозапуск сильнее `preload="none"`: без острова петля, которую посетитель не хочет видеть, качалась бы
  // целиком и стояла.
  it.each([
    ['сохранённое «Меньше»', false, { stored: { motion: 'reduced' } }],
    ['настройка системы без выбора', false, { reduce: true }],
    ['«Полное» вопреки системе', true, { reduce: true, stored: { motion: 'full' } }],
    ['движение разрешено', true, {}],
  ] as const)('%s — видео-петля качается с загрузки страницы: %s', async (_, fetching, visit) => {
    const page = open(visit)
    await page.ready()
    expect(page.fetching()).toBe(fetching)
    expect(page.playing()).toBe(false)
  })

  // Без скрипта при системном сокращении браузер не выбирает ни одного источника петли: «Полное» — выбор
  // посетителя вопреки системе — снимает с них условие движения и запускает выбор заново.
  it('«Полное» вопреки системе — петля получает источник', async () => {
    const page = open({ reduce: true, stored: { motion: 'full' } })
    await page.ready()
    expect(page.conditions()).toEqual(['', ''])
    expect(page.source()).toMatch(/\/loop\.av1\.mp4$/)
    expect(page.reloads()).toBe(1)
  })

  it('«Полное» кликом при системном сокращении — источник встаёт без перезагрузки страницы', async () => {
    const page = open({ reduce: true })
    await page.ready()
    expect(page.source()).toBe('')
    expect(page.reloads()).toBe(0)
    page.chooseMotion('full')
    expect(page.source()).toMatch(/\/loop\.av1\.mp4$/)
    expect(page.reloads()).toBe(1)
    await page.play()
    // «Как в системе» при сокращённом движении — остановка с обрывом загрузки: ещё один load().
    page.chooseMotion('')
    expect(page.playing()).toBe(false)
    expect(page.fetching()).toBe(false)
    expect(page.reloads()).toBe(2)
    // Ролик уже выбран: «Полное» его запускает, а не выбирает заново.
    page.chooseMotion('full')
    expect(page.reloads()).toBe(2)
    expect(page.playing()).toBe(true)
  })

  it('движение разрешено системой: источники петли и выбранный ролик не трогаются', async () => {
    const page = open()
    await page.ready()
    const conditions = page.conditions()
    page.chooseMotion('full')
    page.system({ prefersReducedMotion: 'reduce' })
    expect(page.conditions()).toEqual(conditions)
    expect(page.source()).toMatch(/\/loop\.av1\.mp4$/)
    expect(page.reloads()).toBe(0)
  })

  // Отказ — обычный исход play(): без обработки он всплыл бы ошибкой страницы.
  it('отказ браузера в автозапуске петли — не ошибка страницы', async () => {
    const page = open({ stored: { motion: 'reduced' } })
    await page.ready()
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    try {
      page.refuseAutoplay()
      page.chooseMotion('')
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(unhandled).not.toHaveBeenCalled()
    } finally {
      process.off('unhandledRejection', unhandled)
    }
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

  // Выбор сбросили на другой странице («Как в системе», очистка данных сайта): ключа в хранилище нет —
  // атрибута тоже, а тема возвращается к заданной разметкой.
  it('страница из кеша переходов «назад» снимает выбор, сброшенный после неё', async () => {
    const chosen = { theme: 'dark', motion: 'reduced' }
    const bySystem = open({ stored: chosen })
    const byMarkup = open({ stored: chosen, preset: 'light' })
    for (const page of [bySystem, byMarkup]) {
      await page.ready()
      expect(page.dataset()).toEqual(chosen)
      page.restore({})
      expect(page.motionPressed()).toEqual([''])
    }
    expect(bySystem.dataset()).toEqual({})
    expect(bySystem.darkPressed()).toEqual(['false'])
    expect(byMarkup.dataset()).toEqual({ theme: 'light' })
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
