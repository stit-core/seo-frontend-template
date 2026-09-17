import type { Handle } from '@sveltejs/kit'
import { sequence } from '@sveltejs/kit/hooks'
import { cacheKey, HtmlCache } from '@/shared/cache'
import { PRERENDER_ORIGIN, RENDER_MODE, resolveOrigin, resolveRobotsPolicy } from '@/shared/config'
import { getTextDirection, paraglideMiddleware } from '@/shared/i18n'
import { building } from '$app/environment'
import { env } from '$env/dynamic/private'

// A: origin печётся в prerendered HTML на сборке (один образ на среду).
// C: в HTML уезжает плейсхолдер, entrypoint контейнера подменяет его на старте.
// D: prerender'а нет вовсе, origin читается из env на каждый рендер.
function buildTimeOrigin(): string {
  if (RENDER_MODE === 'A') return resolveOrigin(process.env.SITE_URL, PRERENDER_ORIGIN)
  return PRERENDER_ORIGIN
}

const runtime: Handle = async ({ event, resolve }) => {
  event.locals.origin = building ? buildTimeOrigin() : resolveOrigin(env.SITE_URL, event.url.origin)
  event.locals.robotsPolicy = building ? 'index' : resolveRobotsPolicy(env.ROBOTS_POLICY)

  const response = await resolve(event)
  if (event.locals.robotsPolicy === 'noindex') {
    response.headers.set('x-robots-tag', 'noindex, nofollow')
  }
  return response
}

export const htmlCache = new HtmlCache({
  ttlSec: Number(env.HTML_CACHE_TTL ?? (RENDER_MODE === 'D' ? 60 : 0)),
  swrSec: Number(env.HTML_CACHE_SWR ?? 600),
  max: Number(env.HTML_CACHE_MAX ?? 500),
})

const NO_CACHE = new Set(['/now', '/en/now', '/contact', '/en/contact', '/healthz'])

// Локаль выводится из пути: strategy = ['url', 'baseLocale'], cookie в ключе нет.
function localeOf(pathname: string): string {
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'ru'
}

const cache: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url
  if (
    building ||
    !htmlCache.enabled ||
    event.request.method !== 'GET' ||
    event.url.search !== '' ||
    NO_CACHE.has(pathname) ||
    pathname.startsWith('/internal/')
  ) {
    return resolve(event)
  }

  const { response, state } = await htmlCache.wrap(
    cacheKey(event.request.method, pathname, localeOf(pathname)),
    async () => resolve(event),
  )
  if (state !== 'BYPASS' && response.headers.get('content-type')?.startsWith('text/html')) {
    response.headers.set('cache-control', 'public, max-age=0, must-revalidate')
  }
  return response
}

const i18n: Handle = ({ event, resolve }) =>
  paraglideMiddleware(event.request, ({ request, locale }) => {
    event.request = request
    return resolve(event, {
      transformPageChunk: ({ html }) =>
        html.replace('%lang%', locale).replace('%dir%', getTextDirection(locale)),
    })
  })

export const handle: Handle = sequence(runtime, cache, i18n)
