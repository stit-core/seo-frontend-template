import node from '@astrojs/node'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, memoryCache } from 'astro/config'

// Три варианта развилки «один образ на все среды» (см. отчёт, §5):
//  A (static)      — prerender всего; SITE_URL зашивается на сборке;
//  C (placeholder) — prerender с плейсхолдером, штамповка origin при старте;
//  D (server)      — рендер на запрос + кеш в памяти процесса, SITE_URL из env.
const VARIANT = (process.env.SPIKE_VARIANT ?? 'A') as 'A' | 'C' | 'D'

const SITE_URL =
  VARIANT === 'C' ? 'https://__site_origin__' : (process.env.SITE_URL ?? 'http://localhost:3201')

export default defineConfig({
  site: SITE_URL,
  output: VARIANT === 'D' ? 'server' : 'static',
  adapter: node({ mode: 'standalone', experimentalDisableStreaming: true }),

  trailingSlash: 'never',
  // 'file' ломает родительские маршруты, у которых есть дочерние (/blog, /en):
  // статик-хендлер видит каталог и ищет blog/index.html. Только 'directory'.
  build: { format: 'directory' },

  redirects: {
    '/old': { status: 301, destination: '/' },
  },

  i18n: {
    defaultLocale: 'ru',
    locales: ['ru', 'en'],
    routing: { prefixDefaultLocale: false },
  },

  image: {
    responsiveStyles: true,
    layout: 'constrained',
  },

  // Контентному сайту не нужны сессии; fs-драйвер адаптера пишет в cacheDir
  // и ломает read-only контейнер.
  session: false,

  // Без островов не должно быть ни байта JS — prefetch/view transitions выключены.
  prefetch: false,

  cache: { provider: memoryCache({ max: 500 }) },
  routeRules: {
    '/': { maxAge: 60, swr: 600, tags: ['page', 'blog'] },
    '/about': { maxAge: 300, swr: 3600, tags: ['page'] },
    '/blog': { maxAge: 60, swr: 600, tags: ['blog'] },
    '/blog/[...page]': { maxAge: 60, swr: 600, tags: ['blog'] },
    '/en': { maxAge: 60, swr: 600, tags: ['page', 'blog'] },
    '/en/[...path]': { maxAge: 60, swr: 600, tags: ['page'] },
    '/contact': { maxAge: 300, swr: 3600, tags: ['page'] },
    // /_image в on-demand режиме пересжимает картинку на КАЖДЫЙ запрос (~300 мс) —
    // без этого правила вариант D не годится для страниц с картинками.
    '/_image': { maxAge: 31536000, tags: ['image'] },
    '/rss.xml': { maxAge: 600, swr: 600, tags: ['blog'] },
    '/sitemap.xml': { maxAge: 600, swr: 600, tags: ['blog'] },
    // /now и /healthz намеренно не кешируются: нет maxAge — нет записи в кеш.
  },

  integrations: [react(), sitemap()],

  vite: {
    plugins: [tailwindcss()],
  },
})
