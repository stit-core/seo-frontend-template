import { fileURLToPath } from 'node:url'
import node from '@astrojs/node'
import tailwindcss from '@tailwindcss/vite'
import type { AstroIntegration } from 'astro'
import { defineConfig } from 'astro/config'
import { load } from 'js-yaml'
import { contentSecurityPolicy } from './scripts/lib/site-policy.mjs'
import { writeSitemap } from './scripts/lib/sitemap.mjs'
import { TRAILING_SLASH } from './src/shared/redirects/table.ts'

// Один образ на все среды: на сборке в prerendered-выход попадает плейсхолдер
// (валидный URL — голый __SITE_ORIGIN__ Astro отвергает), при старте контейнера
// docker/entrypoint.sh штампует реальный SITE_URL. Пустой SITE_URL — то же, что
// незаданный; рантайм (docker/server.mjs) с плейсхолдером не стартует.
const PLACEHOLDER = 'https://__site_origin__'
process.env.SITE_URL ||= PLACEHOLDER

// YAML репозитория (`content/*.yaml`, реестр ботов `shared/seo/crawlers.yaml`) импортируется как
// модуль: разбирается здесь, на сборке, и в серверный бандл попадают данные, а не парсер
// (js-yaml — им же Astro читает frontmatter). Пустой файл — `null`; форму данных проверяет Zod в
// месте импорта.
const yamlModules = {
  name: 'yaml-modules',
  transform(code: string, id: string) {
    if (!id.endsWith('.yaml')) return null
    return { code: `export default ${JSON.stringify(load(code) ?? null)}`, map: null }
  },
}

// Endpoint изображений в собранном сайте закрыт (`src/pages/_image.ts` отвечает 404): картинки
// оптимизирует сборка, а живой /_image — DoS по CPU и памяти. В `astro dev` он нужен самой
// разработке — там страницы рендерятся на запрос, — поэтому подмена только для `astro build`.
const closedImageEndpoint: AstroIntegration = {
  name: 'closed-image-endpoint',
  hooks: {
    'astro:config:setup': ({ command, updateConfig }) => {
      if (command === 'build') {
        updateConfig({ image: { endpoint: { entrypoint: './src/pages/_image.ts' } } })
      }
    },
  },
}

// Модули приложения, которые docker/server.mjs и docker/stamp.mjs импортируют из dist/server.
const WRAPPER_ENTRIES = {
  'runtime-config.mjs': 'src/shared/config/runtime.ts',
  'redirects.mjs': 'src/app/middleware/redirects.ts',
}

// Карта сайта — файл сборки: пишется по страницам dist/client, когда они собраны (кто в карте и с
// какой датой — scripts/lib/sitemap.mjs). Страница попадает в карту и выпадает из неё сама; в
// `astro dev` карты нет.
const sitemapFromBuild: AstroIntegration = {
  name: 'sitemap-from-build',
  hooks: {
    'astro:build:done': ({ dir }) => writeSitemap(fileURLToPath(dir)),
  },
}

export default defineConfig({
  site: process.env.SITE_URL,
  integrations: [closedImageEndpoint, sitemapFromBuild],
  output: 'static',
  // Дефолтный лимит тела у адаптера — 1 ГиБ, а разбор формы буферизует тело в heap процесса
  // (`--max-old-space-size=384`): предел на порядок ниже потолка памяти. Свой, куда более
  // тесный предел формы держит `features/contact-form` по Content-Length; тело без длины
  // (chunked) в процессе ограничивает только этот.
  adapter: node({
    mode: 'standalone',
    experimentalDisableStreaming: true,
    bodySizeLimit: 1024 * 1024,
    // CSP prerendered-страницы — заголовком из dist/_headers.json (его отдаёт статик-хендлер), а не
    // <meta>: frame-ancestors в <meta> не действует.
    staticHeaders: true,
  }),
  security: {
    // За TLS-терминирующим прокси адаптер строит URL запроса как `http://<Host>`, и встроенная
    // проверка отвечала бы 403 на любой POST формы из браузера. Origin заявки сверяет
    // `features/contact-form` — с runtime `SITE_URL`, до которого прокси не дотягивается.
    checkOrigin: false,
    // CSP на каждой странице: on-demand — заголовок ответа, prerendered — статик-хендлер.
    // Директивы и хеши островов — политика сборки (scripts/lib/site-policy.mjs).
    csp: contentSecurityPolicy(),
  },
  // Та же форма — без хвостового слеша — у канона пути, по которому отвечает обёртка процесса.
  trailingSlash: TRAILING_SLASH,
  // 'file' + node-адаптер = 404 на /blog и /en (статик-хендлер видит каталог); только 'directory'.
  build: { format: 'directory' },
  i18n: { defaultLocale: 'ru', locales: ['ru', 'en'], routing: { prefixDefaultLocale: false } },
  image: { responsiveStyles: true, layout: 'constrained' },
  // fs-драйвер сессий адаптера пишет в cacheDir и ломает read-only контейнер.
  session: false,
  // Без островов — ни байта JS; prefetch и <ClientRouter/> не включать.
  prefetch: false,
  // Подсветка кода инлайнит сырые цвета темы Shiki мимо токен-слоя (и не знает про
  // light/dark); контент-сайту она не обязательна. Нужна — `shikiConfig` с темой
  // `css-variables` и переменные `--astro-code-*` в app/styles/index.css.
  markdown: { syntaxHighlight: false },
  vite: {
    plugins: [
      tailwindcss(),
      yamlModules,
      // docker/* работают раньше приложения и берут его модули по имени файла: схему env (env
      // проверяется до старта той же схемой, что его читает) и таблицу адресов (обёртка отвечает
      // на адрес раньше статик-хендлера). Каждый — отдельный файл серверной сборки со стабильным
      // именем, а экземпляр модуля у обёртки и приложения общий.
      {
        name: 'wrapper-entries',
        apply: 'build',
        applyToEnvironment: (environment) => environment.name === 'ssr',
        buildStart() {
          for (const [fileName, source] of Object.entries(WRAPPER_ENTRIES)) {
            this.emitFile({
              type: 'chunk',
              id: fileURLToPath(new URL(source, import.meta.url)),
              fileName,
            })
          }
        },
      },
    ],
  },
})
