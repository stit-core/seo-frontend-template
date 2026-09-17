import type { Reroute } from '@sveltejs/kit'
import { baseLocale, deLocalizeUrl } from '@/shared/i18n'

// Единое дерево маршрутов: /en/blog обслуживается роутом /blog.
// Префикс базовой локали (/ru/...) — чужой URL: пропускаем как есть, чтобы был 404,
// а не вторая копия страницы (deLocalizeUrl схлопнул бы его в /...).
export const reroute: Reroute = ({ url }) => {
  if (url.pathname === `/${baseLocale}` || url.pathname.startsWith(`/${baseLocale}/`)) {
    return url.pathname
  }
  return deLocalizeUrl(url).pathname
}
