import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { Browser } from 'happy-dom'
import type * as SharedConfig from '@/shared/config'
import { brotliBytes, cspHash, ISLANDS } from '../../../scripts/lib/site-policy.mjs'

const { config } = vi.hoisted(() => ({ config: { METRIKA_ID: '' } }))

vi.mock('@/shared/config', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedConfig>()),
  get METRIKA_ID() {
    return config.METRIKA_ID
  },
}))

const Metrika = (await import('./metrika.astro')).default

const render = async () => {
  const container = await AstroContainer.create()
  return container.renderToString(Metrika)
}

describe('Metrika', () => {
  // /de-template ставит номер в site.ts: остров с ним проходит typecheck, только если поле — string.
  it('идентификатор счётчика — строка, а не литерал умолчания', () => {
    expectTypeOf<typeof SharedConfig.METRIKA_ID>().toEqualTypeOf<string>()
  })

  it('без идентификатора счётчика разметка пуста — сторонних скриптов на сайте нет', async () => {
    config.METRIKA_ID = ''
    expect((await render()).trim()).toBe('')
  })

  it('с идентификатором — один инлайн-скрипт в бюджете своей строки реестра, который грузит счётчик после простоя', async () => {
    config.METRIKA_ID = '12345678'
    const html = await render()
    const scripts = html.match(/<script[^>]*>/g) ?? []
    expect(scripts).toHaveLength(1)
    expect(scripts[0]).not.toContain('src=')
    expect(html).toContain('12345678')
    expect(html).toContain('requestIdleCallback')
    expect(html).toContain('mc.yandex.ru/metrika/tag.js')
    // `defer` в init подавил бы автоматический просмотр страницы — счётчик стоял бы пустым.
    expect(html).not.toContain('defer')
    expect(html).toContain("'init'")
    const [script = ''] = html.match(/<script[^>]*>[\s\S]*?<\/script>/g) ?? []
    // Сборка шаблона остров не печатает: его вес сверяет только этот тест — той же мерой, что seo:check.
    expect(brotliBytes(script)).toBeLessThanOrEqual(ISLANDS.metrika.budget)
  })

  // CSP пропускает остров по хешу из политики: тело одно на любой идентификатор, иначе каждый
  // счётчик требовал бы своей строки политики.
  it('тело острова — хеш из политики, при любом идентификаторе', async () => {
    for (const id of ['12345678', '87654321']) {
      config.METRIKA_ID = id
      const body = /<script[^>]*>([\s\S]*?)<\/script>/.exec(await render())?.[1] ?? ''
      expect(cspHash(body), id).toBe(ISLANDS.metrika.hash)
    }
  })

  it('после простоя грузит tag.js и инициализирует счётчик идентификатором из разметки', async () => {
    config.METRIKA_ID = '12345678'
    const browser = new Browser({
      settings: {
        // Исполняется только инлайн-скрипт острова из этого репозитория; tag.js не качается.
        enableJavaScriptEvaluation: true,
        suppressInsecureJavaScriptEnvironmentWarning: true,
        disableJavaScriptFileLoading: true,
        handleDisabledFileLoadingAsSuccess: true,
        // В happy-dom нет requestIdleCallback: остров ждёт запасным таймером, здесь — без паузы.
        timer: { maxTimeout: 0 },
      },
    })
    try {
      const page = browser.newPage()
      page.content = `<!doctype html><html><head>${await render()}</head><body></body></html>`
      await page.waitUntilComplete()
      // Очередь вызовов до загрузки tag.js — её счётчик разбирает первой.
      const calls = String(page.mainFrame.evaluate('JSON.stringify(window.ym?.a)'))
      expect(JSON.parse(calls)).toEqual([['12345678', 'init']])
      const loaders = page.mainFrame.document.head.querySelectorAll(
        'script[src="https://mc.yandex.ru/metrika/tag.js"]',
      )
      expect(loaders).toHaveLength(1)
    } finally {
      await browser.close()
    }
  })
})
