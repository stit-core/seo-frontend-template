import type { APIContext, MiddlewareNext } from 'astro'
import type * as SharedConfig from '@/shared/config'
import type { RuntimeConfig } from '@/shared/config'
import { localeOf } from '@/shared/i18n'
import { buildRedirectTable } from '@/shared/redirects'
import redirects from '../../../content/redirects.yaml'

// Живой process.env подменяется целиком; из конфига наблюдаемость читает ровно эти ключи —
// остальные в тесте не участвуют.
const { env } = vi.hoisted(() => {
  const env: Pick<RuntimeConfig, 'SITE_URL' | 'LOG_LEVEL' | 'SENTRY_DSN'> = {
    SITE_URL: 'https://demo.example',
    LOG_LEVEL: 'info',
    SENTRY_DSN: '',
  }
  return { env }
})

vi.mock('@/shared/config', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedConfig>()),
  getRuntimeConfig: () => env as RuntimeConfig,
}))

const { onRequest } = await import('./index')

const html = (body: string, init: ResponseInit = {}) =>
  new Response(body, {
    ...init,
    headers: { 'content-type': 'text/html; charset=utf-8', ...init.headers },
  })

const page: MiddlewareNext = () => Promise.resolve(html('<h1>Страница</h1>'))
const notFound: MiddlewareNext = () =>
  Promise.resolve(
    new Response('<h1>404</h1>', { status: 404, headers: { 'content-type': 'text/html' } }),
  )

async function run(
  path: string,
  next: MiddlewareNext,
  {
    headers = {},
    prerendered = false,
  }: { headers?: Record<string, string>; prerendered?: boolean } = {},
): Promise<Response> {
  const url = new URL(path, env.SITE_URL)
  const context = {
    isPrerendered: prerendered,
    request: new Request(url, { headers }),
    url,
    // rid отсюда забирают on-demand маршруты для своих событий.
    locals: {} as App.Locals,
  } as unknown as APIContext
  return (await onRequest(context, next)) as Response
}

const logged = (fn: (...args: unknown[]) => void) =>
  vi.mocked(fn).mock.calls.map(([line]) => JSON.parse(String(line)) as Record<string, unknown>)

describe('app/middleware', () => {
  beforeEach(() => {
    env.LOG_LEVEL = 'info'
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('prerendered-маршрут проходит как есть: без rid, кеша и лога', async () => {
    const next = vi.fn(page)
    const response = await run('/blog', next, { prerendered: true })
    expect(next).toHaveBeenCalledOnce()
    expect(response.headers.get('x-request-id')).toBeNull()
    expect(response.headers.get('cache-control')).toBeNull()
    expect(console.info).not.toHaveBeenCalled()
  })

  // В `astro dev` страница сборки — тоже prerendered-маршрут: правило на её пути там не проверить,
  // его отдаёт обёртка процесса и держит HTTP-набор.
  it('prerendered-маршрут таблицу адресов не читает: правило с query на пути страницы — мимо', async () => {
    const next = vi.fn(page)
    const response = await run('/?p=123', next, { prerendered: true })
    expect(next).toHaveBeenCalledOnce()
    expect(response.status).toBe(200)
  })

  it('on-demand HTML без Cache-Control получает no-cache; rid принимается из запроса', async () => {
    const response = await run('/xx', notFound, { headers: { 'x-request-id': 'rid-1' } })
    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('no-cache')
    expect(response.headers.get('x-request-id')).toBe('rid-1')
    expect(logged(console.warn)).toEqual([
      expect.objectContaining({
        lvl: 'warn',
        method: 'GET',
        path: '/xx',
        status: 404,
        rid: 'rid-1',
      }),
    ])
  })

  it('без входящего X-Request-Id генерирует UUID', async () => {
    const response = await run('/stranica', page)
    expect(response.headers.get('x-request-id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  it('Cache-Control роута важнее умолчания middleware', async () => {
    const live: MiddlewareNext = () =>
      Promise.resolve(
        html('<h1>Ответ формы</h1>', { headers: { 'cache-control': 'private, no-store' } }),
      )
    expect((await run('/api/contact', live)).headers.get('cache-control')).toBe('private, no-store')
  })

  it('не-HTML ответ без Cache-Control не трогает', async () => {
    const plain: MiddlewareNext = () =>
      Promise.resolve(new Response('ok', { headers: { 'content-type': 'text/plain' } }))
    const response = await run('/api/x', plain)
    expect(response.headers.get('cache-control')).toBeNull()
    expect(response.headers.get('x-request-id')).toBeTruthy()
  })

  it('адреса из content/redirects.yaml и неканоническая форма — до роутинга, next не вызывается', async () => {
    const next = vi.fn(page)
    const moved = await run('/old?x=1', next)
    expect(next).not.toHaveBeenCalled()
    expect(moved.status).toBe(301)
    expect(moved.headers.get('location')).toBe('/blog?x=1')
    expect(moved.headers.get('cache-control')).toBeNull()
    expect(moved.headers.get('x-request-id')).toBeTruthy()

    const gone = await run('/blog/staraya-zametka', next)
    expect(gone.status).toBe(410)
    expect(gone.headers.get('cache-control')).toBe('no-cache')
    expect(gone.headers.get('x-robots-tag')).toBe('noindex')
    // Удалённый адрес — ответ на языке префикса своего адреса.
    for (const { path } of buildRedirectTable(redirects).rules.filter((rule) => !('to' in rule))) {
      const answer = await run(path, next)
      expect(answer.status, path).toBe(410)
      expect(await answer.text(), path).toContain(`<html lang="${localeOf(path)}">`)
    }

    // В образе неканоническую форму раньше отдаёт обёртка процесса; запросу, который дошёл до
    // middleware, оно отвечает тем же.
    const slashed = await run('/stranica/?x=1', next)
    expect(slashed.status).toBe(301)
    expect(slashed.headers.get('location')).toBe('/stranica?x=1')
    expect(next).not.toHaveBeenCalled()
  })

  // Astro раскодирует путь в `context.url`; канон считается по адресу запроса, иначе путь, который
  // обёртка сочла каноническим, middleware вернул бы редиректом на него же.
  it('адрес берётся из запроса, а не из нормализованного context.url', async () => {
    const next = vi.fn(page)
    const context = {
      isPrerendered: false,
      request: new Request(new URL('/a%5Bb%5D', env.SITE_URL)),
      url: new URL('/a[b]', env.SITE_URL),
      locals: {} as App.Locals,
    } as unknown as APIContext
    const response = (await onRequest(context, next)) as Response
    expect(response.status).toBe(200)
    expect(next).toHaveBeenCalledOnce()
  })

  it('не GET и не HEAD адресом не занимается: запрос идёт маршруту', async () => {
    const next = vi.fn(page)
    const url = new URL('/old', env.SITE_URL)
    const context = {
      isPrerendered: false,
      request: new Request(url, { method: 'POST' }),
      url,
      locals: {} as App.Locals,
    } as unknown as APIContext
    await onRequest(context, next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('ошибка рендера: лог 500 с тем же rid, ошибка пробрасывается дальше', async () => {
    const boom = new Error('render failed')
    const next: MiddlewareNext = () => Promise.reject(boom)
    await expect(run('/stranica', next, { headers: { 'x-request-id': 'rid-500' } })).rejects.toBe(
      boom,
    )
    expect(logged(console.error)).toEqual([
      expect.objectContaining({ lvl: 'error', path: '/stranica', status: 500, rid: 'rid-500' }),
    ])
  })

  it('успешный /healthz логируется только на debug', async () => {
    const ok: MiddlewareNext = () =>
      Promise.resolve(new Response('ok', { headers: { 'content-type': 'text/plain' } }))
    await run('/healthz', ok)
    expect(console.info).not.toHaveBeenCalled()
    env.LOG_LEVEL = 'debug'
    await run('/healthz', ok)
    expect(logged(console.info)).toEqual([
      expect.objectContaining({ lvl: 'debug', path: '/healthz', status: 200 }),
    ])
  })

  it('строка лога не содержит query и cookie', async () => {
    // Значения вне алфавита hex: в строке лога есть случайный UUID запроса.
    await run('/stranica?token=secret', page, { headers: { cookie: 'session=private-cookie' } })
    const [entry] = logged(console.info)
    expect(Object.keys(entry ?? {})).toEqual([
      'ts',
      'lvl',
      'method',
      'path',
      'status',
      'dur_ms',
      'rid',
    ])
    expect(entry).toMatchObject({ lvl: 'info', method: 'GET', path: '/stranica', status: 200 })
    expect(typeof entry?.ts).toBe('string')
    expect(typeof entry?.dur_ms).toBe('number')
    expect(JSON.stringify(entry)).not.toContain('secret')
    expect(JSON.stringify(entry)).not.toContain('private-cookie')
  })
})
