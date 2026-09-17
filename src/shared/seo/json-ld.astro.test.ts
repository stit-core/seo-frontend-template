import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { breadcrumbList } from './json-ld'
import JsonLdScript from './json-ld.astro'

describe('JsonLdScript', () => {
  beforeEach(() => vi.stubEnv('SITE_URL', 'https://demo.example'))
  afterEach(() => vi.unstubAllEnvs())

  it('печатает data block с JSON, который парсится обратно', async () => {
    const data = breadcrumbList([{ name: 'Главная', href: '/' }, { name: 'Блог </script>' }])
    const container = await AstroContainer.create()
    const html = await container.renderToString(JsonLdScript, { props: { data } })
    const match = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)
    expect(match).not.toBeNull()
    expect(JSON.parse(match?.[1] ?? '')).toEqual(data)
    expect(html.match(/<\/script>/g)).toHaveLength(1)
  })
})
