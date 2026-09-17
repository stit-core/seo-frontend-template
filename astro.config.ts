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
  // Подсветка кода инлайнит сырые цвета темы Shiki мимо токен-слоя (и не знает про
  // light/dark); контент-сайту она не обязательна. Нужна — `shikiConfig` с темой
  // `css-variables` и переменные `--astro-code-*` в app/styles/index.css.
  markdown: { syntaxHighlight: false },
  vite: { plugins: [tailwindcss(), yamlModules] },
})
