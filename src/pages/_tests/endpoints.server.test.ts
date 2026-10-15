import type { APIContext, APIRoute } from 'astro'
import type * as SharedConfig from '@/shared/config'
import { CLEAN_PARAMS } from '@/shared/config'
import { ALL as imageEndpoint } from '../_image.ts'
import { GET as indexNowKey } from '../[key].txt.ts'
import { GET as healthz } from '../healthz.ts'
import { GET as robotsTxt } from '../robots.txt.ts'

// Политика ИИ-ботов — поле сборки, а не env: кейс задаёт её здесь.
const { site } = vi.hoisted(() => ({ site: { aiBots: 'allow-all' } }))

vi.mock('@/shared/config', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedConfig>()),
  get AI_BOTS_POLICY() {
    return site.aiBots
  },
}))

const ORIGIN = 'https://demo.example'

// Маршрутам из контекста запроса нужны только параметры пути и пропсы getStaticPaths.
const get = <P extends Record<string, unknown>>(
  route: APIRoute<P>,
  params: Record<string, string> = {},
  props: Partial<P> = {},
): Promise<Response> => Promise.resolve(route({ params, props } as unknown as APIContext<P>))

beforeEach(() => {
  vi.stubEnv('SITE_URL', ORIGIN)
  // Профиль — прод-умолчания, а не окружение оболочки: staging и ключ задают сами кейсы.
  vi.stubEnv('ROBOTS_POLICY', 'index')
  vi.stubEnv('INDEXNOW_KEY', '')
})
afterEach(() => {
  vi.unstubAllEnvs()
  site.aiBots = 'allow-all'
})

describe('robots.txt', () => {
  // /de-template ставит политику проекта в site.ts: маршрут с ней проходит typecheck, только если
  // поле — объединение политик, а не литерал умолчания.
  it('политика ИИ-ботов — одна из трёх, а не литерал умолчания', () => {
    expectTypeOf<typeof SharedConfig.AI_BOTS_POLICY>().toEqualTypeOf<SharedConfig.AiBotsPolicy>()
  })

  it('прод: сайт открыт, Clean-param со служебными параметрами сайта, абсолютная строка Sitemap; сам файл — не страница выдачи', async () => {
    const response = await get(robotsTxt)
    expect(await response.text()).toBe(
      `User-agent: *\nAllow: /\n\nClean-param: ${CLEAN_PARAMS.join('&')}\n\nSitemap: ${ORIGIN}/sitemap.xml\n`,
    )
    expect(response.headers.get('cache-control')).toBe('public, max-age=300')
    expect(response.headers.get('x-robots-tag')).toBe('noindex')
  })

  it('staging (ROBOTS_POLICY=noindex): закрыт целиком и без карты сайта', async () => {
    vi.stubEnv('ROBOTS_POLICY', 'noindex')
    expect(await (await get(robotsTxt)).text()).toBe('User-agent: *\nDisallow: /\n')
  })

  it('политика ИИ-ботов из site.ts: её боты закрыты именной группой, `*` открыта', async () => {
    site.aiBots = 'allow-search-deny-training'
    const groups = (await (await get(robotsTxt)).text()).trim().split('\n\n')
    expect(groups[0]).toBe('User-agent: *\nAllow: /')
    expect(groups[1]).toMatch(/^User-agent: GPTBot\n(User-agent: \S+\n)+Disallow: \/$/)
    expect(groups[1]).not.toContain('OAI-SearchBot')
    expect(groups.at(-1)).toBe(`Sitemap: ${ORIGIN}/sitemap.xml`)

    site.aiBots = 'deny-all'
    expect(await (await get(robotsTxt)).text()).toContain('User-agent: OAI-SearchBot\n')
  })

  it('staging закрыт целиком и при политике с запретом: именных групп нет', async () => {
    vi.stubEnv('ROBOTS_POLICY', 'noindex')
    site.aiBots = 'deny-all'
    expect(await (await get(robotsTxt)).text()).toBe('User-agent: *\nDisallow: /\n')
  })
})

describe('ключ IndexNow', () => {
  const KEY = 'demo-key-0123456789'

  it('ключ задан: /<ключ>.txt отдаёт сам ключ, чужое имя — 404', async () => {
    vi.stubEnv('INDEXNOW_KEY', KEY)
    const own = await get(indexNowKey, { key: KEY })
    expect([own.status, await own.text()]).toEqual([200, KEY])
    expect(own.headers.get('cache-control')).toBe('public, max-age=300')
    expect(own.headers.get('x-robots-tag')).toBe('noindex')

    const other = await get(indexNowKey, { key: 'other-0123456789' })
    expect(other.status).toBe(404)
    expect(other.headers.get('cache-control')).toBe('no-cache')
    expect(other.headers.get('x-robots-tag')).toBe('noindex')
  })

  it('ключ не задан: любой *.txt — 404', async () => {
    expect((await get(indexNowKey, { key: KEY })).status).toBe(404)
  })
})

describe('/_image', () => {
  it('endpoint изображений закрыт: 404 текстом без трансформации, вне индекса', async () => {
    const response = await get(imageEndpoint)
    expect([response.status, await response.text()]).toEqual([404, 'Not found'])
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(response.headers.get('cache-control')).toBe('no-cache')
    expect(response.headers.get('x-robots-tag')).toBe('noindex')
  })
})

describe('healthz', () => {
  it('живость процесса: ok без кеша', async () => {
    const response = await get(healthz)
    expect([response.status, await response.text()]).toEqual([200, 'ok'])
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})
