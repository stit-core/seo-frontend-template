import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'

// Дефолт нужен только чтобы билд не падал: реальный origin приезжает из env контейнера.
const siteUrl = process.env.NUXT_PUBLIC_SITE_URL || 'https://stit-demo.local'

// Профиль рендера переключается одним env — так один и тот же код проверяется в двух режимах.
const renderMode = process.env.RENDER_MODE === 'swr' ? 'swr' : 'prerender'

const prerenderRules = {
  '/': { prerender: true },
  '/about': { prerender: true, noScripts: true },
  '/contact': { prerender: true },
  '/blog': { prerender: true },
  '/blog/page/**': { prerender: true },
  '/blog/**': { prerender: true },
  '/en': { prerender: true },
  '/en/about': { prerender: true },
  '/en/contact': { prerender: true },
  '/en/blog': { prerender: true },
  '/en/blog/page/**': { prerender: true },
  '/en/blog/**': { prerender: true },
} as const

const swrRules = {
  '/': { swr: 600 },
  '/about': { swr: 600, noScripts: true },
  '/contact': { swr: 600 },
  '/blog': { swr: 600 },
  '/blog/page/**': { swr: 600 },
  '/blog/**': { swr: 600 },
  '/en': { swr: 600 },
  '/en/about': { swr: 600 },
  '/en/contact': { swr: 600 },
  '/en/blog': { swr: 600 },
  '/en/blog/page/**': { swr: 600 },
  '/en/blog/**': { swr: 600 },
} as const

export default defineNuxtConfig({
  compatibilityDate: '2026-09-15',

  // ── FSD-раскладка ───────────────────────────────────────────────
  srcDir: 'src',
  dir: {
    pages: 'pages',
    layouts: 'app/layouts',
    plugins: 'app/plugins',
    middleware: 'app/middleware',
    assets: 'app/assets',
  },
  // Явные импорты вместо магии: ни композаблов, ни компонентов по соглашению.
  imports: { autoImport: false },
  components: { dirs: [] },

  // Порядок значим: @nuxtjs/seo должен грузиться ДО @nuxt/content, иначе модуль sitemap
  // печатает предупреждение о поломке интеграции с коллекциями.
  modules: ['@nuxt/eslint', '@nuxtjs/seo', '@nuxt/content', '@nuxt/image', '@nuxtjs/i18n'],

  css: ['~/app/styles/index.css'],

  vite: { plugins: [tailwindcss()] },

  typescript: { strict: true, typeCheck: false },

  // ── SEO / site config ───────────────────────────────────────────
  site: {
    url: siteUrl,
    name: 'stit demo',
    defaultLocale: 'ru',
    indexable: process.env.ROBOTS_POLICY !== 'noindex',
  },

  sitemap: {
    autoI18n: true,
    exclude: ['/now', '/en/now'],
    xslColumns: [
      { label: 'URL', width: '60%' },
      { label: 'Last Modified', select: 'sitemap:lastmod', width: '40%' },
    ],
  },

  // node:sqlite вместо better-sqlite3: минус 17 МБ нативных prebuild'ов в образе.
  content: {
    experimental: { sqliteConnector: 'native' },
  },

  robots: {
    // Модуль сам ругается на закрытие /_nuxt/** и /api/** — это требование I-16 канона.
    disallow: ['/contact'],
  },

  ogImage: {
    // component в defaults запрещён типами: шаблон выбирается через defineOgImageComponent().
    defaults: { width: 1200, height: 630 },
    // playwright есть в devDependencies гейта — без этого модуль тащит playwright-core в .output.
    compatibility: {
      dev: { browser: false },
      runtime: { browser: false },
      prerender: { browser: false },
    },
  },

  schemaOrg: {
    identity: {
      type: 'Organization',
      name: 'stit demo',
    },
  },

  linkChecker: { enabled: false },

  // ── i18n ────────────────────────────────────────────────────────
  i18n: {
    restructureDir: 'src/shared/i18n',
    strategy: 'prefix_except_default',
    defaultLocale: 'ru',
    locales: [
      { code: 'ru', language: 'ru-RU', name: 'Русский', file: 'ru.json' },
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
    ],
    // Без авторедиректа по Accept-Language: требование SEO-канона L-4.
    detectBrowserLanguage: false,
    // baseUrl НЕ задаём: он попадает в site-config поверх runtimeEnv и убивает подмену SITE_URL.
  },

  // dir резолвится модулем относительно srcDir, а public/ лежит в корне.
  image: {
    dir: '../public',
    // ipx по умолчанию отдаёт max-age=60; routeRules его не перебивают — только опция стораджа.
    ipx: { fs: { maxAge: 31536000 } },
    format: ['avif', 'webp'],
    screens: { sm: 640, md: 768, lg: 1024, xl: 1280 },
  },

  // ── рендеринг ───────────────────────────────────────────────────
  routeRules: {
    ...(renderMode === 'swr' ? swrRules : prerenderRules),
    '/now': {
      prerender: false,
      swr: false,
      robots: false,
      headers: { 'cache-control': 'no-cache' },
    },
    '/en/now': {
      prerender: false,
      swr: false,
      robots: false,
      headers: { 'cache-control': 'no-cache' },
    },
    // ?sent=1 меняет тело — кешировать нельзя
    '/contact': { robots: false, swr: false, prerender: false },
    '/en/contact': { robots: false, swr: false, prerender: false },
    '/old': { redirect: { to: '/', statusCode: 301 } },
    '/fonts/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
    '/covers/**': { headers: { 'cache-control': 'public, max-age=604800' } },
    '/_og/**': { headers: { 'cache-control': 'public, max-age=604800' } },
  },

  nitro: {
    preset: 'node-server',
    compressPublicAssets: { gzip: true, brotli: true },
    prerender: {
      crawlLinks: renderMode === 'prerender',
      failOnError: false,
      routes: renderMode === 'prerender' ? ['/', '/en'] : [],
      ignore: ['/now', '/en/now'],
    },
  },

  experimental: { componentIslands: true },

  alias: {
    '@': fileURLToPath(new URL('./src', import.meta.url)),
  },

  devtools: { enabled: false },
  telemetry: false,
})
