import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import type * as SharedConfig from '@/shared/config'

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

  it('с идентификатором — один инлайн-скрипт, который грузит счётчик после простоя', async () => {
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
  })
})
