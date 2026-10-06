import { fileURLToPath } from 'node:url'
import node from '@astrojs/node'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'
import { load } from 'js-yaml'

// Один образ на все среды: на сборке в prerendered-выход попадает плейсхолдер
// (валидный URL — голый __SITE_ORIGIN__ Astro отвергает), при старте контейнера
// docker/entrypoint.sh штампует реальный SITE_URL. Пустой SITE_URL — то же, что
// незаданный; рантайм (docker/server.mjs) с плейсхолдером не стартует.
const PLACEHOLDER = 'https://__site_origin__'
process.env.SITE_URL ||= PLACEHOLDER

// `content/*.yaml` импортируются как модули: YAML разбирается здесь, на сборке, и в серверный
// бандл попадают данные, а не парсер (js-yaml — им же Astro читает frontmatter). Пустой
// файл — `null`; форму данных проверяет Zod в месте импорта.
const yamlModules = {
  name: 'yaml-modules',
  transform(code: string, id: string) {
    if (!id.endsWith('.yaml')) return null
    return { code: `export default ${JSON.stringify(load(code) ?? null)}`, map: null }
  },
}

export default defineConfig({
  site: process.env.SITE_URL,
  output: 'static',
  // Дефолтный лимит тела у адаптера — 1 ГиБ, а разбор формы буферизует тело в heap процесса
  // (`--max-old-space-size=384`): предел на порядок ниже потолка памяти. Свой, куда более
  // тесный предел формы держит `features/contact-form`.
  adapter: node({
    mode: 'standalone',
    experimentalDisableStreaming: true,
    bodySizeLimit: 1024 * 1024,
  }),
  // За TLS-терминирующим прокси адаптер строит URL запроса как `http://<Host>`, и встроенная
  // проверка отвечала бы 403 на любой POST формы из браузера. Origin заявки сверяет
  // `features/contact-form` — с runtime `SITE_URL`, до которого прокси не дотягивается.
  security: { checkOrigin: false },
  trailingSlash: 'never',
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
      // docker/* проверяют env до старта приложения той же схемой, что его читает: модуль
      // конфига — отдельный файл серверной сборки со стабильным именем, а экземпляр модуля у
      // обёртки и приложения общий (разбор при старте и есть тот, что читают запросы).
      {
        name: 'runtime-config-entry',
        apply: 'build',
        applyToEnvironment: (environment) => environment.name === 'ssr',
        buildStart() {
          this.emitFile({
            type: 'chunk',
            id: fileURLToPath(new URL('src/shared/config/runtime.ts', import.meta.url)),
            fileName: 'runtime-config.mjs',
          })
        },
      },
    ],
  },
})
