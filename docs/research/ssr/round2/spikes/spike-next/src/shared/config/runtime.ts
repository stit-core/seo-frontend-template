import 'server-only'

// Читаем process.env на каждый вызов: значения должны приходить из env контейнера,
// а не запекаться в бандл. Для prerender это всё равно снимок времени сборки —
// см. отчёт, раздел про «один образ на все среды».
export function getSiteUrl(): string {
  return (process.env.SITE_URL ?? 'http://localhost:3204').replace(/\/$/, '')
}

export function isIndexable(): boolean {
  return process.env.ROBOTS_POLICY !== 'noindex'
}

export function getRuntimeConfig() {
  return {
    siteUrl: getSiteUrl(),
    indexable: isIndexable(),
    release: process.env.RELEASE ?? 'unknown',
  }
}
