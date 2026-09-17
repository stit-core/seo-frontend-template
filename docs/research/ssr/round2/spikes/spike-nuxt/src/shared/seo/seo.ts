import { useSiteConfig } from '#imports'

// Абсолютный URL читается из site-config на каждый рендер, а не из билд-константы.
export function absoluteUrl(path: string): string {
  const base = String(useSiteConfig().url ?? '').replace(/\/+$/, '')
  return path === '/' ? `${base}/` : `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso))
}
