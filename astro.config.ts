import node from '@astrojs/node'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

// Один образ на все среды: на сборке в prerendered-выход попадает плейсхолдер
// (валидный URL — голый __SITE_ORIGIN__ Astro отвергает), при старте контейнера
// docker/entrypoint.sh штампует реальный SITE_URL. Пустой SITE_URL — то же, что
// незаданный; рантайм (docker/server.mjs) с плейсхолдером не стартует.
const PLACEHOLDER = 'https://__site_origin__'
process.env.SITE_URL ||= PLACEHOLDER

export default defineConfig({
  site: process.env.SITE_URL,
  output: 'static',
  adapter: node({ mode: 'standalone', experimentalDisableStreaming: true }),
  trailingSlash: 'never',
  // 'file' + node-адаптер = 404 на /blog и /en (статик-хендлер видит каталог); только 'directory'.
  build: { format: 'directory' },
  i18n: { defaultLocale: 'ru', locales: ['ru', 'en'], routing: { prefixDefaultLocale: false } },
  image: { responsiveStyles: true, layout: 'constrained' },
  // fs-драйвер сессий адаптера пишет в cacheDir и ломает read-only контейнер.
  session: false,
  // Без островов — ни байта JS; prefetch и <ClientRouter/> не включать.
  prefetch: false,
  vite: { plugins: [tailwindcss()] },
})
