import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { Browser } from 'happy-dom'
import type * as SharedConfig from '@/shared/config'
import { ISLANDS } from '@/shared/config'
import { DEFAULT_LOCALE } from '@/shared/i18n'
import { brotliBytes, cspHash } from '../../../scripts/lib/site-policy.mjs'
import ConsentBanner from './consent-banner.astro'
import Metrika from './metrika.astro'

const container = await AstroContainer.create()
const islandOf = (counter: string) => container.renderToString(Metrika, { props: { counter } })
const island = await islandOf('12345678')
const bodyOf = (html: string) => /<script[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? ''
// Баннер — как его печатает компонент: договор острова с разметкой проверяется на ней самой.
const banner = await container.renderToString(ConsentBanner, {
  props: { locale: DEFAULT_LOCALE, policy: { href: '/legal/privacy' } },
})

const TAG = 'https://mc.yandex.ru/metrika/tag.js'
const YEAR = 365 * 24 * 60 * 60 * 1000

const browsers: Browser[] = []
afterEach(async () => {
  await Promise.all(browsers.splice(0).map((browser) => browser.close()))
})

const browser = () => {
  const opened = new Browser({
    settings: {
      // Исполняется только инлайн-скрипт острова из этого репозитория; tag.js не качается.
      enableJavaScriptEvaluation: true,
      suppressInsecureJavaScriptEnvironmentWarning: true,
      disableJavaScriptFileLoading: true,
      handleDisabledFileLoadingAsSuccess: true,
      // Простой браузера и запасной таймер острова — без паузы.
      timer: { maxTimeout: 0 },
    },
  })
  browsers.push(opened)
  return opened
}

interface Visit {
  stored?: string | null
  storage?: boolean
}

// Остров исполняется в happy-dom как в браузере. Вход — выбор прошлого визита в хранилище; выходы — баннер страницы,
// загрузчик счётчика, очередь его вызовов и хранилище. `idle` — браузер с `requestIdleCallback` (Chromium): в happy-dom
// его нет, без заглушки остров ждёт запасным таймером (Safari).
function openIn(idle: boolean, { stored, storage = true }: Visit = {}) {
  const page = browser().newPage()
  page.url = 'https://demo.example/blog/zapis'
  const { window } = page.mainFrame
  if (idle) {
    Object.assign(window, {
      requestIdleCallback: (callback: () => void) => window.setTimeout(callback),
    })
  }
  if (!storage) {
    // Хранилище закрыто настройкой браузера: обращение к нему бросает.
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('SecurityError')
      },
    })
  } else if (typeof stored === 'string') window.localStorage.setItem('consent', stored)
  page.content = `<!doctype html><html><head>${island}</head><body>${banner}<main>Текст</main></body></html>`
  const { document } = page.mainFrame
  const click = (selector: string) =>
    document
      .querySelector(selector)
      ?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  return {
    // Документ разобран, таймеры острова (простой браузера) — отработали.
    ready: () => page.waitUntilComplete(),
    shown: () => document.querySelector('[data-consent-banner]')?.hasAttribute('hidden') === false,
    loaders: () => document.querySelectorAll(`script[src="${TAG}"]`).length,
    // Очередь вызовов до загрузки tag.js — её счётчик разбирает первой; без счётчика очереди нет.
    calls: (): unknown =>
      JSON.parse(String(page.mainFrame.evaluate('JSON.stringify(window.ym?.a ?? null)'))),
    accept: () => click('[data-consent="accept"]'),
    reject: () => click('[data-consent="reject"]'),
    click,
    stored: () => window.localStorage.getItem('consent'),
    // Страница возвращается из кеша переходов «назад — вперёд»: скрипты заново не исполняются, а выбор с тех пор
    // сделали или сбросили на другой странице сайта.
    restore: (value: string | null) => {
      if (value === null) window.localStorage.removeItem('consent')
      else window.localStorage.setItem('consent', value)
      const event = new window.Event('pageshow')
      Object.defineProperty(event, 'persisted', { value: true })
      window.dispatchEvent(event)
    },
  }
}

// Документ ещё разбирается: остров исполнен в <head>, баннер приходит следом. Кадры отрисовки тест прокручивает сам.
function parsing() {
  const page = browser().newPage()
  page.url = 'https://demo.example/'
  page.content = '<!doctype html><html><head></head><body></body></html>'
  const { window, document } = page.mainFrame
  const frames: Array<() => void> = []
  Object.assign(window, {
    requestAnimationFrame: (frame: (time: number) => void) => frames.push(() => frame(0)),
  })
  Object.defineProperty(document, 'readyState', { value: 'loading' })
  const script = document.createElement('script')
  script.dataset.counter = '12345678'
  script.textContent = bodyOf(island)
  document.head.append(script)
  return {
    parse: (html: string) => document.body.insertAdjacentHTML('beforeend', html),
    frame: () => {
      for (const frame of frames.splice(0)) frame()
    },
    shown: () => document.querySelector('[data-consent-banner]')?.hasAttribute('hidden') === false,
  }
}

describe('Metrika — остров согласия со счётчиком', () => {
  // /de-template ставит номер в site.ts: остров с ним проходит typecheck, только если поле — string.
  it('идентификатор счётчика — строка, а не литерал умолчания', () => {
    expectTypeOf<typeof SharedConfig.METRIKA_ID>().toEqualTypeOf<string>()
  })

  it('один инлайн-скрипт без загрузки и больше ничего — в бюджете своей строки реестра с запасом', () => {
    const scripts = island.match(/<script[^>]*>[\s\S]*?<\/script>/g) ?? []
    expect(scripts).toHaveLength(1)
    const [script = ''] = scripts
    expect(script).not.toMatch(/<script[^>]*\ssrc=/)
    // Вывод острова — только его тег: preconnect или dns-prefetch рядом открыли бы соединение со счётчиком до согласия.
    expect(island.trim()).toBe(script)
    // Сборка шаблона остров не печатает: его вес сверяет только этот тест — той же мерой, что seo:check.
    // Бюджет — норма реестра: факт с запасом 10 %, округлённый вверх до 25 Б, — не меньше и не больше.
    const norm = brotliBytes(script) * 1.1
    expect(norm).toBeLessThanOrEqual(ISLANDS.metrika.budget)
    expect(ISLANDS.metrika.budget).toBeLessThanOrEqual(Math.ceil(norm / 25) * 25)
  })

  // CSP пропускает остров по хешу из политики: тело одно на любой идентификатор, иначе каждый счётчик требовал бы своей
  // строки политики.
  it('тело острова — хеш из его строки реестра при любом идентификаторе: идентификатор — атрибутом', async () => {
    for (const id of ['12345678', '87654321']) {
      const html = await islandOf(id)
      expect(cspHash(bodyOf(html)), id).toBe(ISLANDS.metrika.hash)
      expect(html).toContain(`data-counter="${id}"`)
    }
  })
})

// Счётчик ждёт простоя браузера: ветку `requestIdleCallback` идёт Chromium, запасной таймер — браузер без него.
describe.each([
  ['браузер с requestIdleCallback', true],
  ['браузер без него — запасной таймер', false],
])('Metrika — поведение: %s', (_, idle) => {
  const open = (visit: Visit = {}) => openIn(idle, visit)

  it('до выбора баннер открыт, а счётчика нет — ни загрузчика, ни очереди, и после простоя браузера', async () => {
    const page = open()
    await page.ready()
    expect(page.shown()).toBe(true)
    expect([page.loaders(), page.calls()]).toEqual([0, null])
  })

  it('«Принять» закрывает баннер, запоминает выбор и после простоя грузит счётчик — один раз', async () => {
    const page = open()
    await page.ready()
    page.accept()
    expect(page.shown()).toBe(false)
    expect(page.stored()).toMatch(/^accept \d+$/)
    await page.ready()
    expect([page.loaders(), page.calls()]).toEqual([1, [['12345678', 'init']]])
    page.accept()
    await page.ready()
    expect(page.loaders()).toBe(1)
  })

  it('«Отклонить» закрывает баннер и запоминает выбор: счётчика нет', async () => {
    const page = open()
    await page.ready()
    page.reject()
    expect(page.shown()).toBe(false)
    expect(page.stored()).toMatch(/^reject \d+$/)
    await page.ready()
    expect([page.loaders(), page.calls()]).toEqual([0, null])
  })

  it('выбор действует на следующей странице: отказ — без баннера и счётчика, согласие — без баннера со счётчиком', async () => {
    const refused = open()
    refused.reject()
    const next = open({ stored: refused.stored() })
    await next.ready()
    expect([next.shown(), next.loaders()]).toEqual([false, 0])

    const agreed = open()
    agreed.accept()
    const after = open({ stored: agreed.stored() })
    await after.ready()
    expect([after.shown(), after.loaders(), after.calls()]).toEqual([
      false,
      1,
      [['12345678', 'init']],
    ])
  })

  // Выбор действует год (вариант «согласие» базы strategy); значение не из словаря острова — не выбор.
  it.each([
    ['согласие старше года', `accept ${Date.now() - YEAR - 60_000}`],
    ['согласие без времени', 'accept'],
    ['время не числом', 'accept soon'],
    ['чужое значение', `yes ${Date.now()}`],
    ['пробел впереди', ` accept ${Date.now()}`],
  ])('%s — баннер снова, счётчика нет', async (_, stored) => {
    const page = open({ stored })
    await page.ready()
    expect([page.shown(), page.loaders()]).toEqual([true, 0])
  })

  it('выбор моложе года — в силе', async () => {
    const page = open({ stored: `accept ${Date.now() - YEAR + 60_000}` })
    await page.ready()
    expect([page.shown(), page.loaders()]).toEqual([false, 1])
  })

  // На медленной сети шапка видна раньше, чем документ дочитан: баннер, который разбор добавил после острова, открыт
  // к следующему кадру — до своей отрисовки, а не к концу загрузки.
  it('пока документ разбирается, остров открывает баннер к следующему кадру', () => {
    const page = parsing()
    page.parse(banner)
    expect(page.shown()).toBe(false)
    page.frame()
    expect(page.shown()).toBe(true)
  })

  it('хранилище закрыто: баннер на каждой странице, выбор действует на этой', async () => {
    const page = open({ storage: false })
    await page.ready()
    expect(page.shown()).toBe(true)
    page.accept()
    expect(page.shown()).toBe(false)
    await page.ready()
    expect(page.loaders()).toBe(1)
  })

  it('страница из кеша переходов «назад» берёт выбор, сделанный или сброшенный после неё', async () => {
    const agreed = open()
    await agreed.ready()
    agreed.restore(`accept ${Date.now()}`)
    expect(agreed.shown()).toBe(false)
    await agreed.ready()
    expect(agreed.loaders()).toBe(1)

    const refused = open()
    await refused.ready()
    refused.restore(`reject ${Date.now()}`)
    await refused.ready()
    expect([refused.shown(), refused.loaders()]).toEqual([false, 0])

    // Данные сайта очищены на другой странице: выбора нет — баннер снова.
    const cleared = open({ stored: `reject ${Date.now()}` })
    await cleared.ready()
    expect(cleared.shown()).toBe(false)
    cleared.restore(null)
    expect(cleared.shown()).toBe(true)
  })

  it('клик мимо кнопок баннера ничего не трогает', async () => {
    const page = open()
    await page.ready()
    page.click('main')
    page.click('[data-consent-banner] p')
    await page.ready()
    expect([page.shown(), page.stored(), page.loaders()]).toEqual([true, null, 0])
  })
})
