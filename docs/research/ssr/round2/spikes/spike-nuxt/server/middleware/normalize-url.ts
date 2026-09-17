import { defineEventHandler, getRequestURL, sendRedirect } from 'h3'

// Внутренние префиксы Nuxt/модулей трогать нельзя: в /__nuxt_island/<PascalName>_<hash>.json
// регистр значим, и нормализация ломает острова.
const SKIP_PREFIX_RE = /^\/(?:__|_nuxt|_ipx|_og|_i18n|api|\.well-known)/

export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  if (url.pathname === '/' || SKIP_PREFIX_RE.test(url.pathname)) {
    return
  }

  let pathname = url.pathname
  if (pathname.endsWith('/')) {
    pathname = pathname.replace(/\/+$/, '')
  }
  if (/[A-Z]/.test(pathname)) {
    pathname = pathname.toLowerCase()
  }

  if (pathname !== url.pathname) {
    return sendRedirect(event, `${pathname}${url.search}`, 301)
  }
})
