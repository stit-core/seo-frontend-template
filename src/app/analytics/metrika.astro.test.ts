import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import type * as SharedConfig from '@/shared/config'

// Отдельного файла у острова нет: его бюджет — байты отрендеренного <script> на каждой странице.
const INLINE_BUDGET_BYTES = 650

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
  it('без идентификатора счётчика разметка пуста — сторонних скриптов на сайте нет', async () => {
    config.METRIKA_ID = ''
    expect((await render()).trim()).toBe('')
  })

  it('с идентификатором — один инлайн-скрипт в бюджете, который грузит счётчик после простоя', async () => {
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
    expect(Buffer.byteLength(script, 'utf8')).toBeLessThanOrEqual(INLINE_BUDGET_BYTES)
  })
})
