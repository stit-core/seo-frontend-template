import type { APIContext, APIRoute } from 'astro'
import type * as SharedConfig from '@/shared/config'
import { ALL as imageEndpoint } from '../_image.ts'
import { GET as indexNowKey } from '../[key].txt.ts'
import { GET as feedEn } from '../en/rss.xml.ts'
import { GET as healthz } from '../healthz.ts'
import { GET as robotsTxt } from '../robots.txt.ts'
import { GET as feedRu } from '../rss.xml.ts'

vi.mock('astro:content', () => import('./fixtures').then((fixtures) => fixtures.astroContent))

// Политика ИИ-ботов — поле сборки, а не env: кейс задаёт её здесь.
const { site } = vi.hoisted(() => ({ site: { aiBots: 'allow-all' } }))

vi.mock('@/shared/config', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedConfig>()),
  get AI_BOTS_POLICY() {
    return site.aiBots
  },
}))

const ORIGIN = 'https://demo.example'

// Служебным маршрутам из контекста запроса нужны только параметры пути.
const get = (route: APIRoute, params: Record<string, string> = {}): Promise<Response> =>
  Promise.resolve(route({ params } as unknown as APIContext))

beforeEach(() => {
  vi.stubEnv('SITE_URL', ORIGIN)
  // Профиль — прод-умолчания, а не окружение оболочки: staging и ключ задают сами кейсы.
  vi.stubEnv('ROBOTS_POLICY', 'index')
  vi.stubEnv('INDEXNOW_KEY', '')
  // Vitest работает в dev-режиме Vite; режим сборки, где черновиков нет, задаётся явно.
  vi.stubEnv('DEV', false)
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

  it('прод: сайт открыт, абсолютная строка Sitemap; сам файл — не страница выдачи', async () => {
    const response = await get(robotsTxt)
    expect(await response.text()).toBe(
      `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`,
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
    expect(groups[2]).toBe(`Sitemap: ${ORIGIN}/sitemap.xml`)

    site.aiBots = 'deny-all'
    expect(await (await get(robotsTxt)).text()).toContain('User-agent: OAI-SearchBot\n')
  })

  it('staging закрыт целиком и при политике с запретом: именных групп нет', async () => {
    vi.stubEnv('ROBOTS_POLICY', 'noindex')
    site.aiBots = 'deny-all'
    expect(await (await get(robotsTxt)).text()).toBe('User-agent: *\nDisallow: /\n')
  })
})

describe('фиды', () => {
  const links = (xml: string) =>
    [...xml.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>/g)].map(([, link]) => link)

  it('у каждой локали свои записи без черновика, свой язык и self-ссылка', async () => {
    const ru = await get(feedRu)
    const ruXml = await ru.text()
    expect(links(ruXml)).toEqual([
      `${ORIGIN}/blog/para`,
      `${ORIGIN}/blog/odna`,
      `${ORIGIN}/blog/zametka-4`,
      `${ORIGIN}/blog/zametka-3`,
      `${ORIGIN}/blog/zametka-2`,
      `${ORIGIN}/blog/zametka-1`,
    ])
    expect(ruXml).toContain('<language>ru</language>')
    expect(ruXml).toContain(`<atom:link href="${ORIGIN}/rss.xml" rel="self"`)

    const enXml = await (await get(feedEn)).text()
    expect(links(enXml)).toEqual([
      `${ORIGIN}/en/blog/pair`,
      `${ORIGIN}/en/blog/note-2`,
      `${ORIGIN}/en/blog/note-1`,
    ])
    expect(enXml).toContain('<language>en</language>')
    expect(enXml).toContain(`<atom:link href="${ORIGIN}/en/rss.xml" rel="self"`)

    expect(ru.headers.get('content-type')).toBe('application/rss+xml; charset=utf-8')
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
