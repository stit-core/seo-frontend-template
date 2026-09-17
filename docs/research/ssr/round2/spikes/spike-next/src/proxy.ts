import { type NextRequest, NextResponse } from 'next/server'
import { DEFAULT_LOCALE, isLocale } from '@/shared/i18n'

// NextResponse.rewrite() на self-host запускает proxy повторно — уже с переписанным
// путём. Маркер в заголовке запроса разрывает второй проход, иначе внутренний
// /ru/* попадает под редирект ниже и получается петля.
const REWRITE_MARK = 'x-locale-rewritten'

const LOCALE_HEADER = 'x-locale'

function requestHeaders(request: NextRequest, locale: string, rewritten: boolean) {
  const headers = new Headers(request.headers)
  headers.set(LOCALE_HEADER, locale)
  if (rewritten) headers.set(REWRITE_MARK, '1')
  return headers
}

export function proxy(request: NextRequest) {
  if (request.headers.get(REWRITE_MARK) === '1') return NextResponse.next()

  const { pathname, search } = request.nextUrl
  const first = pathname.split('/')[1] ?? ''

  // Внутренний префикс дефолтной локали наружу не выдаём: /ru/blog → 301 /blog.
  if (first === DEFAULT_LOCALE) {
    const url = request.nextUrl.clone()
    url.pathname = pathname.slice(DEFAULT_LOCALE.length + 1) || '/'
    return NextResponse.redirect(url, 301)
  }

  // global-not-found.tsx не получает params (он вне layout), локаль отдаём ему
  // заголовком запроса.
  const locale = isLocale(first) ? first : DEFAULT_LOCALE

  let response: NextResponse
  if (isLocale(first)) {
    response = NextResponse.next({ request: { headers: requestHeaders(request, locale, false) } })
  } else {
    response = NextResponse.rewrite(
      new URL(`/${DEFAULT_LOCALE}${pathname === '/' ? '' : pathname}${search}`, request.url),
      { request: { headers: requestHeaders(request, locale, true) } },
    )
  }

  // Заголовки из next.config#headers() фиксируются на билде; политика индексации
  // обязана читаться из env контейнера — поэтому она здесь.
  if (process.env.ROBOTS_POLICY === 'noindex') {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next|api|healthz|revalidate|opengraph-image|robots\\.txt|sitemap\\.xml|rss\\.xml|covers|favicon\\.ico).*)',
  ],
}
