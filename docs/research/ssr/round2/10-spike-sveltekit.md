# 10 — Эмпирическая проверка (spike): SvelteKit 2 / Svelte 5 как основа `ssr-frontend-template`

Каталог кода: `scratchpad/spike-sveltekit/`. Порт 3203. Все цифры получены прогоном
на этой машине 16.09.2026, Node v24.9.0, pnpm 10.0.0, Docker 29.8.0, Linux 6.12, 20 CPU.
Машина во время замеров делила CPU с параллельными spike-агентами — где цифры
чувствительны к нагрузке, приводится и «тихий» прогон, и «шумный».

---

## 1. TL;DR

- **Эталонный контент-сайт собран целиком и проходит полный гейт.** `pnpm check`
  (svelte-check → eslint → biome → vitest → steiger → build → size-limit) — **EXIT 0 за 42 с**.
  Реализованы все маршруты спецификации: `/`, `/blog` + `/blog/page/[page=page]`,
  `/blog/[slug]`, `/about`, `/contact` (+ `/contact/spasibo`), `/now`, `/en/*`,
  `/old` → 301, `/healthz`, `/robots.txt`, `/sitemap.xml`, `/rss.xml`,
  `/internal/revalidate` (HMAC), `/internal/stats`.
- **`csr = false` даёт буквально 0 байт JS** — и в проде, и **в dev-режиме**
  (Vite-клиент тоже не инлайнится). Измерено Playwright'ом: на `/`, `/about`,
  `/blog/<slug>`, `/now`, `/en` — `JS(gzip)=0`, ни одного `<script src>`.
  Единственные `<script>` в документе — блоки `application/ld+json`.
- **«Пол» гидрации одного острова — ~41–42 КБ gzip** (Svelte-рантайм 17.6 + клиентский
  роутер Kit 13.8 + entry 1.8 + paraglide 1.5 + узлы маршрута). SvelteKit не умеет
  «остров без роутера»: включил `csr` на странице — получил весь клиентский Kit.
- **`adapter-node` 5.5.7 отдаёт prerendered HTML и `_app/immutable/*` сам**, с
  `Cache-Control: public,max-age=31536000,immutable` на хешированных ассетах,
  ETag/Last-Modified, `Vary: Accept-Encoding` и отдачей предсжатых `.br`/`.gz`.
  **На HTML `Cache-Control` не ставится вообще** — это дыра, которую закрывает шаблон.
  Сжатия на лету нет ни для SSR-ответов, ни для чего-либо ещё.
- **Развилка «один образ на все среды» решается вариантом D.** Prerender (A) печёт
  origin в HTML **и полностью выключает хуки для этих URL**: `ROBOTS_POLICY=noindex`
  на staging не даёт ни `X-Robots-Tag`, ни `<meta robots>` — доказано curl'ом.
  Вариант C (плейсхолдер + `sed` в entrypoint) чинит origin **за 7–8 мс на старте**, но
  не чинит noindex и ломает предсжатие HTML. Вариант D (SSR + LRU-кеш в `handle`)
  даёт TTFB кеш-хита **1.1–2.2 мс** против 0.7–0.9 мс у статики — разница неразличима
  на фоне сети, зато рантайм-origin, рантайм-noindex и вебхук-инвалидация работают.
- **LRU + single-flight написан руками (≈120 строк)** и работает: 200 одновременных
  запросов на холодный ключ → **1 реальный рендер**, 199 HIT; SWR-переход
  MISS → HIT → STALE → HIT подтверждён; `POST /internal/revalidate` с HMAC-SHA256
  чистит ключ (401 на плохой подписи).
- **FSD ложится на SvelteKit почти без боя** — но **`kit.files.*` официально
  `@deprecated`** («recommended to use monorepos instead»). Работает, предупреждений
  в консоль не печатает, но это конфиг «на птичьих правах». Колокация не-`+`-файлов
  в `src/pages/**` подтверждена: роутятся только `+page*`/`+layout*`/`+server`/`+error`.
- **Гейт с `.svelte` работает почти полностью**: Steiger видит импорты во
  `<script>` и ловит и cross-layer, и deep-import; Biome 2.5.13 с
  `html.experimentalFullSupportEnabled: true` форматирует и линтит `.svelte`
  (60 диагностик против 102 без флага); `eslint-plugin-svelte@3.23` совместим с
  ESLint **9.39.5** (ESLint 10 не требуется); Vitest 4 + `@testing-library/svelte` +
  `vitest-axe` работают.
- **Два серьёзных бага конфигурации, которые унаследовал бы шаблон**:
  (1) `eslint-plugin-boundaries` **молчит без `import/resolver: typescript`** — алиас
  `@/features/x` считается внешним пакетом (это касается и текущего SPA-шаблона);
  (2) `fsd/insignificant-slice` в Steiger **не резолвит alias-импорты** и объявляет
  все слайсы «no references» — правило надо выключать.
- **Главный архитектурный подводный камень — barrel + top-level вычисления.**
  `export const X = zodSchema()` / `export const allPosts = build()` в public API
  слайса **не шейкаются** и утаскивают zod/gray-matter/весь Markdown в клиентский
  бандл. Замерено: JS на `/contact` **64.3 → 42.0 КБ gzip** после перевода схемы
  на ленивую фабрику. Лечится правилом «в public API слайса нет top-level вызовов».
- Образ: **173 МБ** (`node:24-alpine`), `node_modules` в рантайме не нужен —
  adapter-node бандлит всё, что лежит в `devDependencies`. Чистая сборка в контейнере
  `pnpm build` = **10.7 с** (из них `vite build` 7.5 с). RSS: 44–48 МиБ по `docker stats`,
  97–121 МБ по `ps -o rss` (разница — разделяемая память). Graceful shutdown по SIGTERM
  — **52 мс**, `docker stop` — 0.3 с, exit code 0.

---

## 2. Версии (факт: `pnpm ls --depth 0` + `npm view`)

Все прямые зависимости — **последние опубликованные на 16.09.2026** (проверено
`npm view <pkg> version`), кроме `@inlang/paraglide-js` (2.25.2 против 2.25.3).

| пакет | установлено | latest | роль |
|---|---|---|---|
| `@sveltejs/kit` | **2.70.3** | 2.70.3 | метафреймворк |
| `svelte` | **5.57.0** | 5.57.0 | runes |
| `@sveltejs/adapter-node` | **5.5.7** | 5.5.7 | Node-сервер |
| `@sveltejs/vite-plugin-svelte` | 7.3.0 | 7.3.0 | |
| `@sveltejs/enhanced-img` | **0.11.0** | 0.11.0 | `<enhanced:img>`; тянет `sharp ^0.34.1`, `vite-imagetools ^9` |
| `vite` | **8.3.0** | — | Rolldown |
| `mdsvex` | 0.12.8 | 0.12.8 | Markdown → Svelte-компонент |
| `gray-matter` | 4.0.3 | — | frontmatter |
| `@inlang/paraglide-js` | **2.25.2** | 2.25.3 | i18n-кодоген |
| `zod` | 4.6.5 | — | контракты |
| `tailwindcss` / `@tailwindcss/vite` | 4.3.3 | — | |
| `@fontsource-variable/inter` | 5.3.0 | — | self-host шрифт |
| `lru-cache` | 11.5.2 | — | кеш HTML |
| `typescript` | **6.0.3** | — | как в SPA-шаблоне |
| `svelte-check` | 4.7.6 | 4.7.6 | типы + шаблоны |
| `@biomejs/biome` | **2.5.13** | — | форматтер/линтер |
| `eslint` | **9.39.5** | (10.x есть) | как в SPA-шаблоне |
| `@eslint/js` | 9.39.5 | 10.0.1 | **latest требует eslint ^10 — пиннить 9.x** |
| `eslint-plugin-svelte` | **3.23.0** | 3.23.0 | peer: `eslint ^8.57.1 \|\| ^9 \|\| ^10` |
| `svelte-eslint-parser` | 1.8.1 | — | ставится явно (pnpm strict) |
| `typescript-eslint` | 8.70.0 | — | |
| `eslint-plugin-boundaries` | **7.2.0** | — | API v7: `dependencies` + `policies` |
| `eslint-import-resolver-typescript` | 4.4.5 | — | **обязателен**, см. §8.6 |
| `steiger` / `@feature-sliced/steiger-plugin` | 0.6.0 / **0.7.0** | — | FSD-линтер |
| `vitest` | 4.1.11 | (5.x есть) | |
| `@testing-library/svelte` | 5.4.2 | — | |
| `vitest-axe` | 0.1.0 | — | старый, нужна ручная аугментация типов |
| `@playwright/test` | **1.63.0** | — | |
| `size-limit` / `@size-limit/file` | 13.1.1 | — | |
| `sharp` | 0.35.4 (+ 0.34.5 транзитивно у enhanced-img) | — | генерация обложек/OG |

Предупреждения peer при установке (зафиксированы, не блокируют):
- `@feature-sliced/steiger-plugin@0.7.0 → tsconfck@3.1.6` требует `typescript@^5`, стоит 6.0.3;
- `@eslint/js@10` требует `eslint@^10` (поэтому пиннут 9.39.5).

Установка воспроизводима: `pnpm install --frozen-lockfile` прошла (`Done in 601ms`,
383 пакета из store). Дозаказано в ходе работы:
`pnpm add -D @eslint/js@9.39.5 globals eslint-plugin-boundaries eslint-import-resolver-typescript svelte-eslint-parser vitest-axe @testing-library/jest-dom`.

---

## 3. Итоговые конфиги

### 3.1 `svelte.config.js`

```js
import adapter from '@sveltejs/adapter-node'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import { mdsvex } from 'mdsvex'

/** @type {import('@sveltejs/kit').Config} */
const config = {
  extensions: ['.svelte', '.md'],

  preprocess: [vitePreprocess(), mdsvex({ extensions: ['.md'] })],

  kit: {
    // precompress у adapter-node — общий флаг для client и prerendered.
    // При C entrypoint штампует origin в .html и удаляет устаревшие .html.br/.gz;
    // ассеты остаются предсжатыми.
    adapter: adapter({ out: 'build', precompress: true }),

    // FSD-раскладка: маршруты в src/pages, $lib == слой shared,
    // документ-шелл и хуки — в слое app.
    files: {
      routes: 'src/pages',
      lib: 'src/shared',
      appTemplate: 'src/app/app.html',
      errorTemplate: 'src/app/error.html',
      hooks: {
        server: 'src/app/hooks.server',
        client: 'src/app/hooks.client',
        universal: 'src/app/hooks',
      },
      params: 'src/app/params',
      assets: 'static',
    },

    alias: {
      '@': 'src',
      '@/*': 'src/*',
    },

    prerender: {
      // Кроулер стартует со всех статических роутов; /en/* добавляем явно,
      // потому что reroute снимает префикс и ссылки на них локализуются рантаймом.
      entries: ['*', '/en', '/en/blog', '/en/about', '/en/contact/spasibo'],
      handleHttpError: 'fail',
    },

    typescript: {
      config: (c) => {
        c.include = [
          ...(c.include ?? []),
          '../*.config.ts',
          '../scripts/**/*',
          '../e2e/**/*',
          '../vitest-setup.d.ts',
        ]
        return c
      },
    },
  },
}

export default config
```

### 3.2 `vite.config.ts`

```ts
import { paraglideVitePlugin } from '@inlang/paraglide-js'
import { enhancedImages } from '@sveltejs/enhanced-img'
import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Режим рендера фиксируется на сборке: A/C пререндерят контент, D рендерит на запрос.
const renderMode = process.env.SITE_RENDER_MODE ?? 'A'

export default defineConfig({
  define: {
    __RENDER_MODE__: JSON.stringify(renderMode),
  },

  plugins: [
    // enhancedImages обязан идти ДО sveltekit
    enhancedImages(),
    tailwindcss(),
    sveltekit(),
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/shared/i18n/paraglide',
      strategy: ['url', 'baseLocale'],
      // Без этого localizeHref('/', { locale: 'en' }) даёт '/en/' — лишний 308.
      trailingSlash: 'never',
      emitTsDeclarations: true,
    }),
  ],
})
```

> Vitest вынесен в отдельный `vitest.config.ts`: **в Vite 8 ключ `test` в `defineConfig`
> больше не типизирован** (`svelte-check`: «Object literal may only specify known
> properties, and 'test' does not exist in type 'UserConfigExport'»).

### 3.3 `vitest.config.ts`

```ts
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: { __RENDER_MODE__: JSON.stringify('A') },
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  plugins: [svelte(), svelteTesting()],
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,svelte.ts}'],
  },
})
```

(`svelte({ hot: false })` не компилируется: `hot` больше нет в `Partial<Options>`.)

### 3.4 `steiger.config.ts`

```ts
import fsd from '@feature-sliced/steiger-plugin'
import { defineConfig } from 'steiger'

export default defineConfig([
  ...fsd.configs.recommended,
  {
    rules: {
      'fsd/forbidden-imports': 'error',
      'fsd/no-public-api-sidestep': 'error',
      'fsd/public-api': 'error',
      // Граф ссылок Steiger не резолвит alias-импорты (@/entities/post),
      // поэтому правило считает все слайсы неиспользуемыми. Ложные срабатывания.
      'fsd/insignificant-slice': 'off',
      'fsd/excessive-slicing': 'warn',
      'fsd/ambiguous-slice-names': 'error',
      'fsd/inconsistent-naming': 'error',
      'fsd/no-segmentless-slices': 'error',
      'fsd/no-reserved-folder-names': 'error',
      'fsd/typo-in-layer-name': 'error',
    },
  },
  {
    // Файловый роутинг SvelteKit: +page/+layout/+server — это маршруты, а не public API слоя.
    files: ['src/pages/**'],
    rules: {
      'fsd/public-api': 'off',
      'fsd/no-layer-public-api': 'off',
      'fsd/segments-by-purpose': 'off',
      'fsd/no-segmentless-slices': 'off',
      'fsd/insignificant-slice': 'off',
      'fsd/excessive-slicing': 'off',
      'fsd/ambiguous-slice-names': 'off',
    },
  },
  {
    // Сегменты app-слоя — хуки и шаблоны документа, у них нет public API.
    files: ['src/app/**'],
    rules: { 'fsd/segments-by-purpose': 'off', 'fsd/public-api': 'off' },
  },
  {
    // Кодоген paraglide.
    files: ['src/shared/i18n/paraglide/**'],
    rules: { 'fsd/public-api': 'off', 'fsd/segments-by-purpose': 'off' },
  },
])
```

### 3.5 `biome.json` (ключевое)

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.5.13/schema.json",
  "files": {
    "ignoreUnknown": true,
    "includes": [
      "**/*.ts", "**/*.js", "**/*.mjs", "**/*.json", "**/*.css", "**/*.svelte",
      "!**/build", "!**/.svelte-kit", "!**/coverage", "!**/node_modules",
      "!**/src/shared/i18n/paraglide", "!**/.measure", "!**/docker",
      "!**/project.inlang", "!**/pnpm-lock.yaml",
      "!**/test-results", "!**/playwright-report"
    ]
  },
  "html": {
    "experimentalFullSupportEnabled": true,   // ← НЕ внутри "parser"
    "formatter": { "enabled": true }
  },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2,
                 "lineWidth": 100, "lineEnding": "lf" },
  "javascript": { "formatter": { "quoteStyle": "single", "semicolons": "asNeeded",
                  "trailingCommas": "all", "arrowParentheses": "always",
                  "bracketSpacing": true, "bracketSameLine": false } },
  "css": { "parser": { "tailwindDirectives": true } },
  "overrides": [
    { "includes": ["scripts/**"],
      "linter": { "rules": { "suspicious": { "noConsole": "off" } } } }
  ],
  "linter": { "enabled": true, "rules": { "preset": "recommended",
    "correctness": { "noUnusedVariables": "error" },
    "style": { "useConst": "error", "useExportType": "error",
               "useImportType": "error", "useTemplate": "error" },
    "suspicious": { "noExplicitAny": "warn",
      "noConsole": { "level": "warn", "options": { "allow": ["warn","error","info"] } } } } }
}
```

### 3.6 `eslint.config.js`

```js
import js from '@eslint/js'
import boundaries from 'eslint-plugin-boundaries'
import svelte from 'eslint-plugin-svelte'
import globals from 'globals'
import svelteParser from 'svelte-eslint-parser'
import tseslint from 'typescript-eslint'
import svelteConfig from './svelte.config.js'

const fsdLayers = ['app', 'pages', 'widgets', 'features', 'entities', 'shared']

export default tseslint.config(
  { ignores: ['build', '.svelte-kit', 'coverage', '.measure', 'node_modules',
              'src/shared/i18n/paraglide', 'test-results', 'playwright-report'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, __RENDER_MODE__: 'readonly' },
    },
    plugins: { boundaries },
    settings: {
      // Без резолвера алиас @/* считается внешним пакетом «@/features» и правило молчит.
      'import/resolver': { typescript: { project: './tsconfig.json' } },
      'boundaries/elements': fsdLayers.map((layer) => ({ type: layer, pattern: `src/${layer}/*` })),
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // boundaries 7: правило переименовано в dependencies, rules → policies.
      'boundaries/dependencies': ['error', {
        default: 'disallow',
        policies: fsdLayers.map((layer, i) => ({
          from: [{ element: { type: layer } }],
          allow: fsdLayers.slice(layer === 'shared' ? i : i + 1)
            .map((lower) => ({ to: { element: { type: lower } } })),
        })),
      }],
      // paths.base у сайта всегда пустой, а href'ы собирает localizeHref():
      // resolve() из $app/paths ждёт route id и с локализацией не стыкуется.
      'svelte/no-navigation-without-resolve': 'off',
      'no-restricted-imports': ['error',
        { patterns: [{ group: ['@/*/*/*/*'], message: 'Deep-импорт мимо public API запрещён' }] }],
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: { parser: svelteParser,
                       parserOptions: { parser: tseslint.parser, svelteConfig } },
  },
  { files: ['src/pages/internal/**'], rules: { 'boundaries/dependencies': 'off' } },
  { files: ['**/*.d.ts'], rules: { '@typescript-eslint/no-empty-object-type': 'off' } },
  { files: ['**/*.config.{js,ts}', 'scripts/**'], rules: { 'no-console': 'off' } },
)
```

### 3.7 `.size-limit.cjs`

```js
// Бюджетируется то, что реально грузит браузер. Контентные страницы идут с
// csr = false и грузят 0 байт JS (проверяется e2e-тестом); сюда попадает
// «пол» гидрации острова: точка входа + рантайм Svelte/Kit + узлы маршрутов.
module.exports = [
  { name: 'client entry (start + app)', path: 'build/client/_app/immutable/entry/*.js',
    limit: '3 KB', gzip: true },
  { name: 'route nodes', path: 'build/client/_app/immutable/nodes/*.js',
    limit: '14 KB', gzip: true },
  { name: 'CSS', path: 'build/client/_app/immutable/assets/*.css',
    limit: '8 KB', gzip: true },
]
```

> Глоб `build/client/_app/immutable/**/*.js` бюджетировать **нельзя**: это 140 КБ gzip
> всего графа, включая чанки, которые ни одна страница не грузит (см. §8.3).

### 3.8 `Dockerfile` + `docker/entrypoint.sh`

```dockerfile
# ── build ───────────────────────────────────────────────────────────
FROM node:24-alpine AS build

WORKDIR /app
ENV PNPM_HOME=/pnpm CI=1
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
ARG SITE_RENDER_MODE=D
ARG SITE_URL
ENV SITE_RENDER_MODE=$SITE_RENDER_MODE SITE_URL=$SITE_URL
RUN pnpm build

# ── runtime ─────────────────────────────────────────────────────────
FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    SHUTDOWN_TIMEOUT=15 \
    KEEP_ALIVE_TIMEOUT=65 \
    HEADERS_TIMEOUT=70

# adapter-node бандлит всё, что лежит в devDependencies: node_modules в рантайме не нужен.
COPY --from=build --chown=node:node /app/build ./build
COPY --chown=node:node docker/entrypoint.sh /entrypoint.sh

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "build"]
```

```sh
#!/bin/sh
set -eu

# Режим C: в prerendered HTML на сборке уехал плейсхолдер — штампуем его
# реальным origin один раз при старте контейнера и выбрасываем предсжатые
# копии HTML (в них остался бы старый origin); sirv отдаст их несжатыми,
# HTML жмёт Traefik.
if [ -d /app/build/prerendered ] && [ -n "${SITE_URL:-}" ]; then
  origin=$(printf '%s' "$SITE_URL" | sed 's#/*$##')
  if grep -rql '__SITE_ORIGIN__' /app/build/prerendered 2>/dev/null; then
    start=$(date +%s%N)
    grep -rl '__SITE_ORIGIN__' /app/build/prerendered \
      | xargs sed -i "s#https://__SITE_ORIGIN__#${origin}#g"
    find /app/build/prerendered -name '*.html.br' -delete
    find /app/build/prerendered -name '*.html.gz' -delete
    end=$(date +%s%N)
    echo "stamped SITE_ORIGIN=${origin} in $(( (end - start) / 1000000 ))ms"
  fi
fi

exec "$@"
```

> В режиме D `build/prerendered` вообще не создаётся — entrypoint просто `exec`'ает.
> Секрет `--mount=type=secret,id=npmrc` из SPA-шаблона в спайке не нужен (публичный
> реестр), в шаблоне вернуть.

### 3.9 `src/app/hooks.server.ts` — runtime-config + LRU + i18n

```ts
import type { Handle } from '@sveltejs/kit'
import { sequence } from '@sveltejs/kit/hooks'
import { cacheKey, HtmlCache } from '@/shared/cache'
import { PRERENDER_ORIGIN, RENDER_MODE, resolveOrigin, resolveRobotsPolicy } from '@/shared/config'
import { getTextDirection, paraglideMiddleware } from '@/shared/i18n'
import { building } from '$app/environment'
import { env } from '$env/dynamic/private'

// A: origin печётся в prerendered HTML на сборке (один образ на среду).
// C: в HTML уезжает плейсхолдер, entrypoint контейнера подменяет его на старте.
// D: prerender'а нет вовсе, origin читается из env на каждый рендер.
function buildTimeOrigin(): string {
  if (RENDER_MODE === 'A') return resolveOrigin(process.env.SITE_URL, PRERENDER_ORIGIN)
  return PRERENDER_ORIGIN
}

const runtime: Handle = async ({ event, resolve }) => {
  event.locals.origin = building ? buildTimeOrigin() : resolveOrigin(env.SITE_URL, event.url.origin)
  event.locals.robotsPolicy = building ? 'index' : resolveRobotsPolicy(env.ROBOTS_POLICY)

  const response = await resolve(event)
  if (event.locals.robotsPolicy === 'noindex') {
    response.headers.set('x-robots-tag', 'noindex, nofollow')
  }
  return response
}

export const htmlCache = new HtmlCache({
  ttlSec: Number(env.HTML_CACHE_TTL ?? (RENDER_MODE === 'D' ? 60 : 0)),
  swrSec: Number(env.HTML_CACHE_SWR ?? 600),
  max: Number(env.HTML_CACHE_MAX ?? 500),
})

const NO_CACHE = new Set(['/now', '/en/now', '/contact', '/en/contact', '/healthz'])

// Локаль выводится из пути: strategy = ['url', 'baseLocale'], cookie в ключе нет.
function localeOf(pathname: string): string {
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'ru'
}

const cache: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url
  if (
    building || !htmlCache.enabled || event.request.method !== 'GET' ||
    event.url.search !== '' || NO_CACHE.has(pathname) || pathname.startsWith('/internal/')
  ) {
    return resolve(event)
  }

  const { response, state } = await htmlCache.wrap(
    cacheKey(event.request.method, pathname, localeOf(pathname)),
    async () => resolve(event),
  )
  if (state !== 'BYPASS' && response.headers.get('content-type')?.startsWith('text/html')) {
    response.headers.set('cache-control', 'public, max-age=0, must-revalidate')
  }
  return response
}

const i18n: Handle = ({ event, resolve }) =>
  paraglideMiddleware(event.request, ({ request, locale }) => {
    event.request = request
    return resolve(event, {
      transformPageChunk: ({ html }) =>
        html.replace('%lang%', locale).replace('%dir%', getTextDirection(locale)),
    })
  })

export const handle: Handle = sequence(runtime, cache, i18n)
```

### 3.10 `src/app/hooks.ts` (universal `reroute`) и `src/app/params/page.ts`

```ts
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
```

```ts
import type { ParamMatcher } from '@sveltejs/kit'

// [page=page] — только натуральные числа, иначе роут не матчится и SvelteKit даёт 404.
export const match: ParamMatcher = (param) => /^[1-9][0-9]*$/.test(param)
```

### 3.11 `src/pages/+layout.ts` — дефолт режима рендера

```ts
// Дефолт сайта: контент пререндерится (A/C) либо рендерится на запрос с кешем (D);
// гидрации нет нигде. Роуты, которым нужен рантайм или интерактив, переопределяют это.
export const prerender = __RENDER_MODE__ !== 'D'
export const csr = false
export const trailingSlash = 'never'
```

### 3.12 `src/shared/seo/meta.ts` (фрагменты) и `seo-head.svelte`

```ts
export const LOCALES = ['ru', 'en'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'ru'

function localizedPath(path: string, locale: Locale): string {
  const clean = path === '/' ? '' : path
  return locale === DEFAULT_LOCALE ? clean || '/' : `/${locale}${clean}`
}

export function absoluteUrl(origin: string, path: string, locale: Locale = DEFAULT_LOCALE): string {
  const p = localizedPath(path, locale)
  return `${origin}${p === '/' ? '/' : p}`
}

export function alternateLinks(origin: string, path: string): AlternateLink[] {
  return [
    ...LOCALES.map((l) => ({ hreflang: l, href: absoluteUrl(origin, path, l) })),
    { hreflang: 'x-default', href: absoluteUrl(origin, path, DEFAULT_LOCALE) },
  ]
}

// Тег собирается здесь, а не в разметке: литерал `<script>` внутри .svelte
// ломает и компилятор Svelte, и svelte-eslint-parser.
const LD_OPEN = `<${'script'} type="application/ld+json">`
const LD_CLOSE = `</${'script'}>`

export function jsonLdTag(json: string): string {
  return LD_OPEN + json.replace(/</g, '\\u003c') + LD_CLOSE
}
```

```svelte
<svelte:head>
  <title>{fullTitle}</title>
  <meta name="description" content={description}>
  <meta name="robots" content={robotsContent(indexable, robotsPolicy)}>
  <link rel="canonical" href={canonical}>
  {#each alternates as alt (alt.hreflang)}
    <link rel="alternate" hreflang={alt.hreflang} href={alt.href}>
  {/each}
  <meta property="og:site_name" content={SITE_NAME}>
  <meta property="og:type" content={ogType}>
  <meta property="og:title" content={fullTitle}>
  <meta property="og:description" content={description}>
  <meta property="og:url" content={canonical}>
  <meta property="og:image" content={ogImage}>
  <meta property="og:locale" content={locale === 'en' ? 'en_GB' : 'ru_RU'}>
  <meta name="twitter:card" content="summary_large_image">
  {#each jsonLd as block, i (i)}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html jsonLdTag(block)}
  {/each}
</svelte:head>
```

### 3.13 `src/pages/robots.txt/+server.ts` и `sitemap.xml/+server.ts`

```ts
import { buildRobots } from '@/shared/seo'
import type { RequestHandler } from './$types'

// Всегда рантайм: знает и актуальный origin, и политику индексации среды.
export const prerender = false

export const GET: RequestHandler = ({ locals }) =>
  new Response(buildRobots(locals.origin, locals.robotsPolicy), {
    headers: { 'content-type': 'text/plain; charset=utf-8',
               'cache-control': 'public, max-age=3600' },
  })
```

```ts
import { allPosts, lastModified } from '@/entities/post'
import { POSTS_PER_PAGE } from '@/shared/config'
import { buildSitemap } from '@/shared/seo'
import type { RequestHandler } from './$types'

export const prerender = false

export const GET: RequestHandler = ({ locals }) => {
  const pages = Math.max(1, Math.ceil(allPosts().length / POSTS_PER_PAGE))
  const entries = [
    { path: '/', lastmod: lastModified() },
    { path: '/blog', lastmod: lastModified() },
    ...Array.from({ length: pages - 1 }, (_, i) => ({ path: `/blog/page/${i + 2}` })),
    ...allPosts().map((p) => ({ path: `/blog/${p.slug}`, lastmod: p.updatedDate })),
    { path: '/about' },
    { path: '/contact' },
  ]
  return new Response(buildSitemap(locals.origin, entries), {
    headers: { 'content-type': 'application/xml; charset=utf-8',
               'cache-control': 'public, max-age=3600' },
  })
}
```

`buildSitemap` выдаёт по `<url>` на каждую пару (путь × локаль), внутри — полный
взаимный `xhtml:link` + `x-default`.

### 3.14 Form action `/contact` (без JS и с JS)

```ts
import { fail, redirect } from '@sveltejs/kit'
import { contactSchema, HONEYPOT_FIELD, MAX_FORM_AGE_MS, MIN_FILL_MS } from '@/features/contact-form'
import { localizeHref } from '@/shared/i18n'
import type { Actions, PageServerLoad } from './$types'

// Form actions несовместимы с prerender; страница интерактивна — здесь гидрация нужна.
export const prerender = false
export const csr = true

export const load: PageServerLoad = ({ setHeaders }) => {
  setHeaders({ 'cache-control': 'no-store' })
  return { issuedAt: Date.now() }
}

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await request.formData()

    // Honeypot: ботам отвечаем так же, как людям, чтобы не подсказывать ловушку.
    if (String(form.get(HONEYPOT_FIELD) ?? '') !== '')
      redirect(303, localizeHref('/contact/spasibo'))

    const age = Date.now() - Number(form.get('issuedAt') ?? 0)
    if (!Number.isFinite(age) || age < MIN_FILL_MS || age > MAX_FORM_AGE_MS) {
      return fail(422, { errors: { message: 'Форма отправлена слишком быстро, попробуйте ещё раз' },
                         values: {} })
    }

    const values = { name: String(form.get('name') ?? ''), email: String(form.get('email') ?? ''),
                     message: String(form.get('message') ?? '') }
    const parsed = contactSchema().safeParse(values)
    if (!parsed.success) {
      const errors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form')
        errors[key] ??= issue.message
      }
      return fail(400, { errors, values })
    }

    // PRG: успешный POST уводит на отдельный URL, чтобы F5 не переотправлял форму.
    redirect(303, localizeHref('/contact/spasibo'))
  },
}
```

### 3.15 LRU-кеш (`src/shared/cache/html-cache.ts`, сокращённо)

```ts
export class HtmlCache {
  async wrap(key: string, render: () => Promise<Response>) {
    if (!this.enabled) return { response: await render(), state: 'BYPASS' as const }
    const entry = this.#cache.get(key)
    if (entry) {
      const age = (Date.now() - entry.storedAt) / 1000
      if (age <= this.#opts.ttlSec) { this.#stats.hit++; return { response: this.#toResponse(entry, 'HIT', age), state: 'HIT' } }
      this.#stats.stale++
      void this.#load(key, render).catch(() => undefined)   // SWR: обновляем в фоне
      return { response: this.#toResponse(entry, 'STALE', age), state: 'STALE' }
    }
    this.#stats.miss++
    return { response: this.#toResponse(await this.#load(key, render), 'MISS', 0), state: 'MISS' }
  }

  /** Single-flight: на холодный кеш N параллельных запросов дают один рендер. */
  #load(key: string, render: () => Promise<Response>): Promise<Entry> {
    const pending = this.#inflight.get(key)
    if (pending) return pending
    const task = (async () => { this.#stats.renders++; /* … */ })()
    this.#inflight.set(key, task)
    task.finally(() => this.#inflight.delete(key))
    return task
  }
}

/** Ключ кеша: метод + путь + локаль. Ни cookie, ни User-Agent в ключе нет. */
export function cacheKey(method: string, pathname: string, locale: string): string {
  return `${method} ${pathname}|${locale}`
}
```

---

## 4. Деревья

### 4.1 `src/` (контент и кодоген paraglide свёрнуты)

```
src/app/            app.html (%lang% / %dir% / %sveltekit.head% / %sveltekit.body%),
                    error.html, app.d.ts (App.Locals: origin, robotsPolicy),
                    hooks.server.ts (runtime → cache → i18n), hooks.ts (reroute),
                    params/page.ts (matcher), styles/index.css (Tailwind v4 @theme + data-scheme)
src/pages/          +layout.svelte | +layout.ts (prerender/csr/trailingSlash) | +layout.server.ts (origin, robotsPolicy)
                    +page.svelte | +page.server.ts        — главная
                    +error.svelte                          — 404/5xx с noindex
                    about/+page.svelte
                    blog/+page.svelte | +page.server.ts
                    blog/page/[page=page]/+page.svelte | +page.server.ts (entries)
                    blog/[slug]/+page.svelte | +page.server.ts (entries + renderPostBody)
                    contact/+page.svelte | +page.server.ts (actions, prerender=false, csr=true)
                    contact/spasibo/+page.svelte           — PRG-цель (303)
                    now/+page.svelte | +page.server.ts     — prerender=false, no-cache
                    old/+page.server.ts                    — redirect(301,'/')
                    healthz/+server.ts, robots.txt/+server.ts,
                    sitemap.xml/+server.ts, rss.xml/+server.ts
                    internal/revalidate/+server.ts (HMAC), internal/stats/+server.ts
src/widgets/        hero/, site-header/, site-footer/      — ui/*.svelte + index.ts
src/features/       contact-form/{config,model,ui}/ + index.ts
src/entities/       post/{api/posts.ts, api/render.ts, model/schema.ts(+test),
                          ui/post-card.svelte(+test), ui/post-cover.svelte,
                          content/*.md (12) + content/covers/*.png} + index.ts
src/shared/         cache/{html-cache.ts,index.ts}   — LRU+SWR+single-flight
                    config/{site.ts,runtime.ts(+test),index.ts}
                    i18n/{index.ts, paraglide/** (кодоген)}
                    lib/{cn.ts,format-date.ts,index.ts}
                    seo/{meta.ts(+test), feeds.ts, seo-head.svelte, index.ts}
e2e/seo.spec.ts · scripts/{gen-content.mjs,gen-og.mjs} · static/{favicon.svg,og-default.png,og/*.png}
корень: svelte.config.js, vite.config.ts, vitest.config.ts, vitest-setup.d.ts,
        tsconfig.json, biome.json, eslint.config.js, steiger.config.ts,
        .size-limit.cjs, playwright.config.ts, Dockerfile, .dockerignore,
        docker/entrypoint.sh, project.inlang/, messages/{ru,en}.json
```

### 4.2 `build/` (adapter-node)

```
build/
  index.js  handler.js  env.js  shims.js  (+ .map)      ← бандл сервера, node_modules не нужен
  server/          index.js, manifest.js, chunks/…      ← SSR-граф (весь контент + zod + gray-matter)
  client/
    _app/immutable/{entry,chunks,nodes,assets}/…        ← JS/CSS/картинки/шрифты с хешами (+ .br/.gz)
    _app/version.json
    favicon.svg, og-default.png, og/*.png               ← содержимое static/
  prerendered/                                          ← ТОЛЬКО в режимах A/C
    index.html, about.html, blog.html, blog/<slug>.html, blog/page/{2,3}.html,
    contact/spasibo.html, en.html, en/**.html           ← 36 html
    **/__data.json                                      ← 36 шт., при csr=false мёртвый груз
    (+ .br/.gz на каждый файл при precompress: true)
```

---

## 5. Единая таблица измерений

`A` — prerender + origin из build-arg; `D` — SSR на запрос + LRU-кеш (`HTML_CACHE_TTL=60`).
Где колонка одна — значение не зависит от режима.

| метрика | A | D | как получено |
|---|---|---|---|
| время `build` (локально, тёплый кеш) | **5.6 с** | **15.1 с**¹ | `time pnpm build` |
| время `build` (чисто, в контейнере) | — | **10.7 с** (`vite build` 7.5 с) | лог `docker build` |
| размер выхода сборки | **5.58 МБ** (client 2.11 / prerendered 0.55 / server 2.90) | **5.15 МБ** (client 2.11 / server 3.01) | `du -sb build` |
| размер Docker-образа | 173 МБ | **173 МБ** | `docker images` |
| HTML главной: raw / gzip-9 / по проводу | 7475 / 2232 / **1708 (br)** | 7475 / 2232 / 7475 (без сжатия) | `curl`, `gzip -9c`, `curl --compressed` |
| HTML поста: raw / gzip-9 / по проводу | 7277 / 2655 / **2065 (br)** | 7277 / 2655 / 7277 | то же |
| HTML `/about`: raw / gzip-9 / провод | 3066 / 1234 / **908 (br)** | 3066 / 1234 / 3066 | то же |
| HTML `/blog`: raw / gzip-9 | 9866 / 2610 | 9866 / 2610 | |
| HTML `/now` (всегда SSR): raw / gzip-9 | 2436 / 995 | 2436 / 995 | |
| **JS главной (gzip)** | **0** | **0** | Playwright, сумма `script`-ресурсов |
| **JS поста `/blog/<slug>` (gzip)** | **0** | **0** | то же |
| **JS `/about`, `/now`, `/en` (gzip)** | **0** | **0** | то же |
| JS `/contact` (остров, gzip) | **41 964** (16 файлов) | 41 964 | то же |
| JS `/en/contact` (gzip) | 40 920 | 40 920 | то же |
| «ноль JS на странице без островов?» | **да, ни одного `<script src>`** | да | `curl \| grep -c '<script src'` = 0 |
| CSS (gzip / по проводу br) | 3819 / **3299** | 3819 / 3299 | один файл `0.*.css`, raw 13 683 |
| шрифты (реально грузится) | 2 файла, **67 004 б** (cyrillic + latin, `unicode-range`, `font-display: swap`) | то же | Playwright; всего 7 сабсетов в сборке |
| обложка: форматы | `<picture>` AVIF → WebP → PNG, `srcset` 800w/1600w, `width`/`height`, `loading`, `fetchpriority`, `decoding` | ← | сырой HTML |
| обложка: байты 800w / 1600w | AVIF 2803 / 4624 · WebP 5142 / 11 630 · PNG 24 710 / 45 863 | ← | `curl -o /dev/null -w '%{size_download}'` |
| TTFB медиана 20, `/` | **0.86 мс** | 1.77–2.12 мс (HIT) / **56 мс** первый MISS² | `curl -w '%{time_starttransfer}'` |
| TTFB `/blog/<slug>` | **0.87 мс** | 1.11–2.21 мс (HIT) / 9.8 мс MISS | |
| TTFB `/about` | 0.91 мс | 1.84 мс (HIT) / 11.8 мс MISS | |
| TTFB `/now` (SSR всегда) | 2.30 мс | 3.50 мс (мин 1.88) | |
| TTFB `/healthz` | 1.11 мс | 2.50 мс (мин 1.05) | |
| TTFB `/sitemap.xml` / `/rss.xml` | 1.42 / 1.41 мс | 2.12 / 1.97 мс | |
| TTFB в контейнере (D, тёплый) | — | `/` 1.26 · `/about` 1.12 · `/blog/<slug>` 1.39 · `/now` 1.91 · `/healthz` 1.30 мс | |
| RSS процесса, idle | **97 МБ** (`ps`) | **99 МБ** (`ps`) / **48 МиБ** (`docker stats`) | |
| RSS после 200 параллельных | **114 МБ** | **121 МБ** / 44 МиБ в контейнере | `xargs -P` + `Promise.all` |
| рендеров на 200 параллельных (холодный ключ) | н/д (статика) | **1** (199 HIT) | `/internal/stats` |
| `/old` | **301** → `/` | 301 | `curl -o /dev/null -w '%{http_code}'` |
| `/blog/net-takogo` | **404** (разметка `+error.svelte`, `<h1>404 — страница не найдена</h1>`, `<meta robots=noindex,nofollow>`) | 404 | |
| `/xx/` | **404** | 404 | |
| `/about/` (нормализация слеша) | **308** → `/about` | 308 | |
| `/ru/about` (префикс базовой локали) | **404** (после правки `reroute`; по умолчанию было 200) | 404 | |
| `/blog/page/0`, `/blog/page/abc` | **404** (param matcher) | 404 | |
| `/en`, `/en/blog`, `/en/about`, `/en/contact`, `/en/blog/<slug>` | 200, `<html lang="en">` | 200 | |
| prerender-страницы отдаёт сам Node-процесс? | **да**: два запроса `/about` дают идентичное тело (md5 совпал), `/now` — разное | prerender'а нет | `curl \| md5sum` ×2 |
| `Cache-Control` на prerendered HTML | **нет вовсе** (только `ETag: W/"…"`, `Last-Modified`, `Vary: Accept-Encoding`) | `public, max-age=0, must-revalidate` (ставит наш хук) + `ETag` | `curl -I` |
| `Cache-Control` на `/_app/immutable/**` | **`public,max-age=31536000,immutable`** + `ETag` | то же | `curl -I` |
| `Cache-Control` на нехешированной статике (`/og-default.png`) | **нет** (только ETag) | нет | `curl -I` |
| сжатие | предсжатые `.br`/`.gz` отдаются sirv для prerendered HTML, CSS, JS, SVG; **SSR-ответы не сжимаются** | только ассеты; HTML не сжимается | `curl -I --compressed` |
| контент для `User-Agent: Googlebot` | `<h1>SSR и индексация…`, полный `<head>`, canonical | то же | `curl -A Googlebot` |
| контент для `YandexBot` | canonical на месте | то же | `curl -A YandexBot` |
| canonical / hreflang ru+en+x-default / OG / JSON-LD в сыром HTML | **все есть** (`Article` + `BreadcrumbList` на посте, `Organization`+`WebSite` на главной) | то же | `curl \| grep -c` |
| dev: старт до первого 200 | **3.9 с** (Vite ready 2.6 с) | — | `time` + polling |
| dev: HMR контента (`*.md`) | **335 мс** до видимого изменения | — | правка + polling |
| dev: HMR `.svelte` | **264 мс** | — | |
| dev: JS на главной | **0** (`<script src>` нет, Vite-клиент не инлайнится при `csr=false`) | — | `curl \| grep '<script'` |
| `--host` | работает (`vite dev --port 3203 --host`, печатает LAN-адреса) | — | |
| graceful shutdown | SIGTERM → процесс завершается за **52 мс**; `docker stop` **0.3 с**, exit 0 | ← | `kill -TERM` + polling |
| healthcheck в контейнере | `healthy` через ~10 с | ← | `docker inspect .State.Health.Status` |
| `pnpm check` целиком | — | **EXIT 0, 42 с** | `pnpm check` |

¹ 15.1 с у D — прогон под нагрузкой от параллельных агентов; при прочих равных D
**быстрее** A (нет фазы prerender 36 страниц), что видно по контейнерной сборке.
² первые 40–60 мс — прогрев модулей сервера (первый рендер вообще), не свойство кеша.

---

## 6. Таблица проверок

| # | что проверяли | результат | команда / способ |
|---|---|---|---|
| 1 | `pnpm install --frozen-lockfile` | ✅ 383 пакета, 601 мс | `pnpm install --frozen-lockfile` |
| 2 | `build/{client,prerendered,server}` появляются | ✅ | `find build -maxdepth 2 -type d` |
| 3 | prerendered HTML отдаёт сам процесс | ✅ | md5 двух ответов `/about` совпал |
| 4 | `immutable`-кеш на хешированных ассетах | ✅ `public,max-age=31536000,immutable` | `curl -I` |
| 5 | `Cache-Control` на prerendered HTML | ❌ отсутствует | `curl -I /about` |
| 6 | ETag | ✅ на статике `W/"len-mtime"`, на SSR — хеш тела (`"13l4tgk"`) | `curl -I` |
| 7 | `precompress: true` — что отдаётся | ✅ `.br` для HTML/CSS/JS/SVG (`Content-Encoding: br`) | `curl -I --compressed` |
| 8 | сжатие на лету | ❌ нет (SSR-ответы идут как есть) | `curl -I --compressed /now` |
| 9 | `ORIGIN`/`PORT`/`HOST`/`BODY_SIZE_LIMIT`/`SHUTDOWN_TIMEOUT`/`IDLE_TIMEOUT` | ✅ все есть + `SOCKET_PATH`, `XFF_DEPTH`, `ADDRESS_HEADER`, `PROTOCOL_HEADER`, `HOST_HEADER`, `PORT_HEADER`, `KEEP_ALIVE_TIMEOUT`, `HEADERS_TIMEOUT`, `LISTEN_PID`/`LISTEN_FDS` | чтение `node_modules/@sveltejs/adapter-node/files/env.js` |
| 10 | `BODY_SIZE_LIMIT=1K` режет тело | ✅ **413** | `curl -XPOST --data-binary @5kb` |
| 11 | keep-alive Node настраивается | ✅ `KEEP_ALIVE_TIMEOUT=65` → `Keep-Alive: timeout=65` (дефолт 5) | `curl -D-` |
| 12 | graceful shutdown | ✅ 52 мс, exit 0, без SIGKILL | `kill -TERM` |
| 13 | `export const prerender = true/false` per-route | ✅ | `find build/prerendered` |
| 14 | `export const csr = false` → 0 байт JS | ✅ на `/`, `/blog/<slug>`, `/about`, `/now`, `/en` | Playwright + `grep '<script src'` |
| 15 | `entries()` для `blog/[slug]` и `blog/page/[page]` | ✅ 12 постов + 2 страницы пагинации в `build/prerendered` | `find` |
| 16 | `prerender.entries` для `/en/*` | ✅ 18 англоязычных html (кроулер добрал остальные по `localizeHref`) | `find build/prerendered/en` |
| 17 | universal `+page.ts` при `csr=false` | ✅ выполняется на сервере, **может вернуть несериализуемое** (Svelte-компонент) — данные не сериализуются в документ; но модуль всё равно попадает в клиентский бандл (§8.3) | эксперимент с `+page.ts`, вернувшим `Component` |
| 18 | `__data.json` при `csr=false` | ⚠️ всё равно генерируется (36 файлов, 0.2 МБ) и никогда не запрашивается | `find build/prerendered -name '__data.json'` |
| 19 | `kit.files.routes: 'src/pages'` | ✅ работает; ⚠️ **`@deprecated`** в типах и в доке | `node_modules/@sveltejs/kit/types/index.d.ts:505` + docs |
| 20 | `kit.files.lib` / `kit.alias` | ✅ `$lib` == `src/shared`, `@/…` == `src/…` | сборка |
| 21 | не-`+`-файлы в `src/pages/**` не роутятся | ✅ `probe.ts` в `src/pages/blog/` не создал маршрут и не сломал сборку | эксперимент |
| 22 | `<enhanced:img>` с динамическим путём из frontmatter | ✅ через `import.meta.glob(..., { eager: true, query: { enhanced: true }, import: 'default' })` | HTML `/blog/<slug>` |
| 23 | AVIF/WebP/фолбэк | ✅ 3 `<source>` + `<img src>`-PNG | HTML |
| 24 | `sharp` на `node:24-alpine` | ✅ ставится и работает в образе (генерация обложек/OG вне рантайма) | `docker build` |
| 25 | paraglide `strategy: ['url','baseLocale']` → `/en/…`, ru без префикса | ✅ `urlPatterns` генерится автоматически | `src/shared/i18n/paraglide/runtime.js` |
| 26 | `reroute` в `hooks.ts` | ✅ одно дерево маршрутов на две локали | код + 200 на `/en/*` |
| 27 | `/xx/` → 404 | ✅ | `curl` |
| 28 | `/ru/about` → 404 | ⚠️→✅ по умолчанию **200** (дубль!), чинится 3 строками в `reroute` | `curl` |
| 29 | `<html lang>` | ✅ через `%lang%` в `app.html` + `transformPageChunk` | `curl \| head -3` |
| 30 | нет авторедиректа по `Accept-Language` | ✅ (стратегия без `preferredLanguage`) | по коду middleware + curl |
| 31 | JS от paraglide при `csr=false` | ✅ **0** | Playwright |
| 32 | `trailingSlash: 'never'` — код редиректа | ✅ **308** (и для prerendered — делает sirv-обёртка адаптера, и для SSR — ядро Kit) | `curl -I /about/` |
| 33 | `redirect(301, '/')` на `/old` | ✅ **301** | `curl -I` |
| 34 | `error(404)` на `/blog/net-takogo` | ✅ **404** + разметка `+error.svelte` + noindex | `curl` |
| 35 | `X-Robots-Tag` из `handle` для **prerendered** | ❌ не работает: sirv отдаёт файл до хуков | `ROBOTS_POLICY=noindex` + `curl -D-` |
| 36 | `X-Robots-Tag` для SSR-страниц (режим D) | ✅ + `<meta robots>` + `Disallow: /` | `curl -D-` |
| 37 | форма без JS | ✅ **303** → `/contact/spasibo`; ошибки → **400**; time-trap → **422**; honeypot → 303 «спасибо» | `curl -XPOST` с браузерным `Accept` |
| 38 | форма с JS (`use:enhance`) | ✅ Playwright-сценарий проходит | `pnpm test:e2e` |
| 39 | встроенная CSRF-защита | ✅ POST без `origin` → **403** | `curl -XPOST` |
| 40 | `handleError` + noindex на 404 | ✅ через `+error.svelte` (`<meta robots=noindex,nofollow>`) | `curl` |
| 41 | LRU в `handle`: HIT/MISS/STALE | ✅ `x-cache` + `age` | `curl -D-` |
| 42 | single-flight на холодный кеш | ✅ 200 параллельных → **1 рендер** | `/internal/stats` |
| 43 | вебхук-инвалидация с HMAC | ✅ 401 при плохой подписи, `{"purged":1}` при хорошей, далее MISS | `openssl dgst -sha256 -hmac` |
| 44 | `svelte-check` | ✅ **1512 файлов, 0 ошибок** | `pnpm typecheck` |
| 45 | Biome 2.5.13 на `.svelte` без флага | ⚠️ 102 ошибки / 42 предупреждения (в основном форматирование `<script>`) | `biome check --config-path=…` |
| 46 | Biome с `html.experimentalFullSupportEnabled: true` | ✅ 60/6, после `--write` — **0**; форматирует `<script>` и разметку | `biome check` |
| 47 | `biome format` на `.svelte` | ✅ работает; де-индентирует тело `<script>` и превращает `<meta … />` → `<meta …>` | diff |
| 48 | `eslint-plugin-svelte@3` на ESLint 9.39.5 | ✅ совместим (peer допускает 8/9/10), ESLint 10 **не нужен** | `pnpm lint` |
| 49 | Steiger видит импорты во `<script>` `.svelte` | ✅ | фикстура `entities/post/ui/violation.svelte` |
| 50 | Steiger ловит cross-layer (`entities → features`) | ✅ «Forbidden import from higher layer "features"» и в `.ts`, и в `.svelte` | фикстуры (потом удалены) |
| 51 | Steiger ловит deep-import мимо public API | ✅ alias **и** относительный, в `.ts` и в `.svelte` | фикстуры |
| 52 | Steiger `insignificant-slice` | ❌ ложные «no references» — граф не резолвит `@/`-алиасы | фикстуры с alias vs relative |
| 53 | `boundaries/dependencies` (ESLint) | ⚠️→✅ **молчит без `import/resolver: typescript`**; с резолвером ловит и `.ts`, и `.svelte` | `ESLINT_PLUGIN_BOUNDARIES_DEBUG=1` |
| 54 | Vitest 4 + `@testing-library/svelte` | ✅ 5 файлов / 23 теста / 1.1 с | `pnpm test` |
| 55 | `vitest-axe` | ✅ работает; ⚠️ нужна ручная аугментация `declare module 'vitest' { interface Matchers extends AxeMatchers {} }` | тест `post-card` |
| 56 | Playwright smoke | ✅ **8/8** | `pnpm test:e2e` |
| 57 | `size-limit` | ✅ entry 2.39/3 КБ, nodes 10.33/14 КБ, CSS 3.82/8 КБ | `pnpm size` |
| 58 | `pnpm check` целиком | ✅ EXIT 0, 42 с | `pnpm check` |
| 59 | Docker build + образ | ✅ 173 МБ, `node_modules` в рантайме не нужен | `docker build`, `docker images` |
| 60 | RSS idle / под нагрузкой (контейнер) | ✅ 48 → 44 МиБ | `docker stats` |
| 61 | RSS endpoint (`/rss.xml`) | ✅ валидный RSS 2.0 с `atom:link rel=self` | `curl` |
| 62 | satori OG | ⏭ не делал; OG-картинки сгенерированы статически `sharp` (`scripts/gen-og.mjs`, 13 PNG 1200×630) | — |
| 63 | `onNavigate` view transitions | ⏭ неприменимо: при `csr=false` клиентского роутера нет, переходы — полная перезагрузка | — |
| 64 | Pagefind | ⏭ не делал (нет в зависимостях) | — |

---

## 7. Развилка «один образ на все среды»: A / C / D

Напоминание условия (`14-content-architecture.md` §2.2.2): абсолютные canonical/OG/hreflang
обязаны знать origin, а origin известен только контейнеру. SvelteKit 2 при prerender
запрещает `$env/dynamic/*`, `/_app/env.js` — только клиентская история.

### 7.1 Что измерено

| | **A — build-arg** | **C — плейсхолдер + `sed` в entrypoint** | **D — SSR + LRU в `handle`** |
|---|---|---|---|
| `SITE_URL` в canonical | печётся на сборке | **штампуется на старте, 7–8 мс** | читается из env на каждый рендер |
| один образ на все среды | ❌ | ✅ | ✅ |
| TTFB `/` (тихо) | **0.86 мс** | **0.96 мс** | 1.77 мс (HIT), 56 мс первый MISS |
| TTFB `/blog/<slug>` | 0.87 мс | 0.69 мс | 1.11 мс (HIT), 9.8 мс MISS |
| TTFB `/now` | 2.30 мс | 1.86 мс | 3.50 мс |
| размер `build` | 5.58 МБ | **5.43 МБ** (после удаления `*.html.br/.gz`; prerendered 0.40 вместо 0.55) | 5.15 МБ |
| предсжатый HTML | ✅ `.br`/`.gz` | ❌ (удаляются; сжимает Traefik) | ❌ (сжимает Traefik) |
| предсжатые JS/CSS/SVG | ✅ | ✅ (сохраняются) | ✅ |
| `ROBOTS_POLICY=noindex` на контенте | ❌ **`<meta robots="index, follow">` и нет `X-Robots-Tag`** | ❌ то же | ✅ `X-Robots-Tag` + `<meta robots>` |
| `robots.txt` / `sitemap.xml` / `rss.xml` | ✅ рантайм-origin (это server routes) | ✅ | ✅ |
| **рассогласование**: canonical ≠ sitemap на staging | ✅ есть и это плохо (canonical → prod, sitemap → staging) | ❌ нет | ❌ нет |
| инвалидация без релиза | ❌ | ❌ | ✅ вебхук HMAC + TTL/SWR |
| 200 параллельных на холодный ключ | н/д | н/д | **1 рендер**, 199 HIT, 165 мс |
| новый класс ошибок | «в проде образ, который не тестировали» + **забыли `SITE_URL` при сборке → `https://__SITE_ORIGIN__` уедет в выдачу** (воспроизведено!) | «забытый плейсхолдер» + `__data.json.br` остаётся со старым origin | кеш холодный после релиза (фича) |
| объём самописного | 0 | **~20 строк sh** | **~120 строк TS** (`shared/cache`) + 30 строк хука + эндпоинт ревалидации |

### 7.2 Доказательство провала A

Сборка с `SITE_URL=https://prod.example.com`, запуск с
`SITE_URL=https://staging.example.com ROBOTS_POLICY=noindex`:

```
# prerendered /about — sirv отдаёт файл ДО хуков
HTTP/1.1 200 OK                       ← ни одного x-robots-tag
<meta name="robots" content="index, follow"/>
<link rel="canonical" href="https://prod.example.com/about"/>

# /now — SSR, хуки работают
x-robots-tag: noindex, nofollow
<link rel="canonical" href="https://staging.example.com/now"/>

# robots.txt — server route, рантайм
User-agent: *
Disallow: /

# sitemap.xml — рантайм
<loc>https://staging.example.com/</loc>
```

То есть в A на staging живёт HTML, который **разрешает индексацию и ссылается
каноникалом на прод** — худший из возможных вариантов.

### 7.3 Вердикт

**Шаблону — D (SSR на запрос + LRU/SWR в `handle`), с `prerender` как точечной опцией
для действительно мёртвых страниц (юридическое, 404-лендинги), и только если для них
приемлемо, что `ROBOTS_POLICY` и `SITE_URL` до них не доходят.**

Обоснование:
1. **Только D закрывает канон целиком.** `X-Robots-Tag` (I-14, I-15), рантайм-canonical
   (I-7), согласованность canonical ↔ sitemap — всё остальное ломается на prerender
   не из-за origin, а потому что **prerendered URL физически не проходят через `handle`**.
2. **Цена в TTFB — около 1 мс** (1.1–2.2 против 0.7–0.9 мс). На фоне RTT до Traefik и
   сети это ноль. В контейнере обе величины 1.1–1.9 мс.
3. **Single-flight снимает главный страх SSR**: всплеск трафика на непрогретый URL не
   даёт N рендеров (измерено: 200 → 1).
4. **C — разумная оптимизация второго шага**, если у проекта реально холодный трафик и
   тысячи страниц: 7–8 мс на старте, ~20 строк sh, ноль рантайм-издержек. Но он
   обязателен в связке с «staging закрывается Traefik'ом (basic-auth) + robots.txt»,
   потому что `X-Robots-Tag` до prerendered-страниц всё равно не доходит.
5. **A — только для проекта с одной средой**, с обязательной строкой в
   `docs/stack/rendering.md` и e2e-тестом «в ответе нет `__SITE_ORIGIN__`» (иначе
   забытый build-arg уезжает в индекс — это воспроизвелось у меня в первом же прогоне).

Практическая рекомендация по кешу для шаблона: `HTML_CACHE_TTL=60`, `HTML_CACHE_SWR=600`,
`HTML_CACHE_MAX=500`, ключ = `метод + путь + локаль` (ни cookie, ни UA), bypass для
`/now`, `/contact`, `/healthz`, `/internal/*` и любых URL с query-строкой,
`Cache-Control: public, max-age=0, must-revalidate` + ETag наружу.

---

## 8. Подводные камни (с источниками)

### 8.1 `kit.files.*` — официально deprecated

Тип `@sveltejs/kit@2.70.3` (`types/index.d.ts:505`) и документация:
> «*deprecated this feature is still supported, but it's generally recommended to use
> [monorepos](https://levelup.video/tutorials/monorepos-with-pnpm) instead»
— https://svelte.dev/docs/kit/configuration (проверено 16.09.2026)

Помечены **все** поля: `src`, `assets`, `hooks.{client,server,universal}`, `lib`,
`params`, `routes`, `serviceWorker`, `appTemplate`, `errorTemplate`.

**Что это значит для шаблона.** Вся FSD-раскладка (`routes: 'src/pages'`,
`lib: 'src/shared'`, `hooks` и `params` в `src/app/`) держится на deprecated-API.
Практически: работает, предупреждений не печатает, удаления не анонсировано, но
это долг. Варианты:
- (а) принять и зафиксировать в `docs/stack/routing.md` как осознанный риск + пришпилить
  минорную версию Kit и проверять на мажорах;
- (б) отказаться от FSD-имён в пользу дефолтов (`src/routes`, `src/lib`) — тогда FSD
  разъезжается с каноном экосистемы;
- (в) компромисс: оставить `routes: 'src/pages'` (это главное для канона) и вернуть
  дефолты для `lib`/`hooks`/`params`/`appTemplate` — меньше deprecated-поверхности,
  но `src/app/` и `src/shared/` перестают быть цельными слоями.

Моя рекомендация — (а) с записью риска: альтернативы хуже, а предупреждение
относится к «монорепе вместо переопределения путей», а не к «скоро уберём».

### 8.2 Prerendered URL не проходят через `handle`

`@sveltejs/adapter-node/files/handler.js`: цепочка
`sequence([serve(client), serve_prerendered(), ssr])`. `sirv` отдаёт файл из
`build/prerendered` до того, как вообще создаётся `Request` для SvelteKit.
Следствия: нет `X-Robots-Tag`, нет `Cache-Control`, нет кеш-хука, нет подмены
origin. Нормализацию слеша адаптер делает сам — **308** (`res.writeHead(308, …)`).

### 8.3 Barrel + top-level вычисления = чужие библиотеки в клиентском бандле

Измерено на `/contact` (единственная гидрируемая страница):

| состояние | JS gzip |
|---|---|
| `export const ContactSchema = z.object({…})` в public API слайса | **64 267 б** |
| схема вынесена за barrel (deep-import) | 41 962 б |
| **схема осталась в barrel, но стала ленивой фабрикой `contactSchema()`** | **41 964 б** |

Механика: Rolldown не может доказать чистоту `z.object(...)` в top-level
инициализаторе, поэтому модуль (а с ним вся zod) остаётся в графе, даже если
биндинг не используется. То же самое было с `export const allPosts = build()`
в `entities/post`: в клиентский чанк уезжали `gray-matter`, `js-yaml` и **все 12
markdown-текстов** (чанк 318 КБ raw). Ленивая фабрика/мемоизированная функция
убирает контент, но `gray-matter` + zod (~300 КБ raw / 110 КБ gzip) остаются в
`build/client` как **мёртвый груз**: их не грузит ни одна страница (проверено —
на `/contact` этих чанков в сети нет), они лежат только в образе.

**Правило для шаблона** (в `.claude/rules/`):
> В `index.ts` слайса не должно быть значений, полученных вызовом. Схемы — функции
> (`postSchema()`), коллекции — мемоизированные геттеры (`allPosts()`), константы —
> в отдельном модуле без зависимостей (`config/`).

Дополнительно: **держите загрузку контента в `+page.server.ts`**. Эксперимент с
`+page.ts` (universal load), возвращающим Svelte-компонент из mdsvex, работает
функционально, но кладёт весь контент в клиентский граф. Рабочая замена —
`render()` из `svelte/server` прямо в серверном load:

```ts
import { render } from 'svelte/server'
const bodies = import.meta.glob('../content/*.md', { eager: true, import: 'default' })
export function renderPostBody(slug: string): string | null {
  const component = bodies[`../content/${slug}.md`]
  return component ? render(component).body : null
}
```
и `{@html data.html}` в разметке. Минус — внутри Markdown нельзя оживить компоненты.

### 8.4 Литерал `<script>` внутри `.svelte` ломает и компилятор, и линтер

`{@html \`<script type="application/ld+json">…</script>\`}` внутри `<svelte:head>` даёт
`svelte-eslint-parser`: `Parsing error: Unexpected keyword or identifier`. Решение —
собирать тег в `.ts` (`` `<${'script'} …>` ``) и передавать строкой. Побочно это
удобное место для экранирования `<` → `<` в JSON-LD.

### 8.5 `Steiger`: `insignificant-slice` не понимает alias-импорты

Эмпирика (фикстуры в `src/widgets/hero/ui/probe.ts`):
- `import { allPosts } from '@/entities/post'` → **референс не засчитан**, слайс
  объявлен «This slice has no references»;
- `import { allPosts } from '../../../entities/post'` → референс засчитан
  («only one reference in slice "widgets/hero"»).

При этом `fsd/forbidden-imports` и `fsd/no-public-api-sidestep` алиасы **понимают**
(они работают по строке пути). Вероятная причина — `tsconfck@3.1.6` внутри
`@feature-sliced/filesystem` требует `typescript@^5`, а в проекте 6.0.3.
**Вывод: `insignificant-slice` (и `excessive-slicing`, который считает так же)
выключать**; архитектурную ценность несут `forbidden-imports` + `no-public-api-sidestep`,
и они работают, включая `.svelte`.

### 8.6 `eslint-plugin-boundaries` без резолвера бесполезен (касается и SPA-шаблона!)

`ESLINT_PLUGIN_BOUNDARIES_DEBUG=1` показал:
```
"to": { "module": { "origin": "external", "source": "@/features",
                    "internalPath": "contact-form" } }
```
— алиас принят за scoped-пакет. Нарушение `entities → features` **не ловилось ни в
`.ts`, ни в `.svelte`**. После добавления
```js
settings: { 'import/resolver': { typescript: { project: './tsconfig.json' } } }
```
правило заработало в обоих форматах:
```
1:32  error  There is no policy allowing dependencies from elements of type
             "entities" to elements of type "features"  boundaries/dependencies
```
В `spa-frontend-template/eslint.config.js` такого `settings['import/resolver']` нет →
там `boundaries/element-types` почти наверняка тоже молчит на `@/`-импортах. **Отдельная
находка, которую стоит вынести владельцу** (см. §11).

Заодно v7 переименовал API: `boundaries/element-types` → **`boundaries/dependencies`**,
`rules` → **`policies`**, строковые селекторы → `{ element: { type } }` / `{ to: {…} }`
(https://www.jsboundaries.dev/docs/releases/migration-guides/v6-to-v7/).

### 8.7 Biome 2.5.13: флаг называется `html.experimentalFullSupportEnabled`

Не `html.parser.experimentalFullSupportEnabled` — Biome отвечает
`Found an unknown key … Known keys: interpolation, vue`. В схеме
(`node_modules/@biomejs/biome/configuration_schema.json`, `$defs.HtmlConfiguration`):
> «experimentalFullSupportEnabled: Enables full support for HTML, Vue, Svelte, and Astro files.»

Эффект на этом проекте: **102 ошибки / 42 предупреждения → 60 / 6**, после `--write` — 0.
Форматирование `.svelte` работает, но со своим стилем: тело `<script>` **не
индентируется**, а самозакрывающиеся void-теги (`<meta … />`) переписываются в
`<meta …>`. Это несовместимо с `prettier-plugin-svelte` — выбирать надо один.

Исключать из `files.includes` обязательно: `src/shared/i18n/paraglide` (кодоген) и
**`project.inlang`** (кеш inlang — там лежат `.json`, которые Biome начнёт
переформатировать и уронит гейт).

### 8.8 SvelteKit CSRF: `403 Cross-site POST form submissions are forbidden`

Из коробки любой POST с form-content-type и без совпадающего `origin` получает **403**.
Это бесплатная защита формы от ботов, но:
- **вебхуки** (`/internal/revalidate`) должны идти с `Content-Type: application/json`,
  иначе тоже 403;
- за Traefik надо задать **`ORIGIN=https://site.example.com`** (или `PROTOCOL_HEADER=x-forwarded-proto`
  + `HOST_HEADER=x-forwarded-host`). Без этого adapter-node подставляет **`https` по
  умолчанию** и на `http`-стенде все формы падают в 403, а `event.url.origin` врёт.
- В доке `csrf.checkOrigin` помечен deprecated в пользу `csrf.trustedOrigins`
  (https://svelte.dev/docs/kit/configuration).

### 8.9 Тестирование form action'ов через curl обманывает

SvelteKit выбирает формат ответа по `Accept`. С дефолтным curl'овым `Accept: */*`
успешный `redirect(303)` приходит как **200 + JSON**
`{"type":"redirect","status":303,"location":"/contact/spasibo"}`. С браузерным
`Accept: text/html,…` — честный **303**. В e2e/скриптах обязательно задавать
браузерный `Accept`.

### 8.10 `gray-matter` разворачивает даты YAML в `Date`

`pubDate: 2026-03-03` без кавычек приходит в схему как `Date`, и `z.iso.date()` падает
на билде (ошибка вылезает в фазе `analyse`, стектрейс указывает на чанк, а не на
исходник). Лечится препроцессором:
```ts
const IsoDate = z.preprocess((v) => (v instanceof Date ? v.toISOString().slice(0,10) : v), z.iso.date())
```
Плюс `gray-matter` тянет `eval` (Rollup ругается: «Use of eval … is strongly discouraged»)
— для сервера некритично, но ещё один аргумент не пускать его в клиентский граф.

### 8.11 paraglide 2.x: `/ru/*` по умолчанию отдаёт дубль страницы

`deLocalizeUrl('/ru/about')` канонизирует первый сегмент и возвращает `/about` —
маршрут находится, страница отдаётся **200** с canonical на `/about`. Для канона
(L-2: «невалидный префикс локали → 404») нужен явный guard в `reroute` (см. §3.10).
Также обязателен `trailingSlash: 'never'` в опциях `paraglideVitePlugin`, иначе
`localizeHref('/', { locale: 'en' })` даёт `/en/` и каждая ссылка на смену языка
стоит лишний 308.

### 8.12 `precompress` у adapter-node — один флаг на `client` и `prerendered`

`index.js` адаптера: `builder.compress(out/client)` и `builder.compress(out/prerendered)`
под одним `if (precompress)`. Отключить предсжатие только для HTML нельзя —
поэтому вариант C правильнее реализовывать как «precompress: true + удалить
`*.html.br|gz` в entrypoint после `sed`». Иначе теряются `.br` и для JS/CSS.
Дефолт опции — **`true`** (в типах `@default true`).

### 8.13 `svelte/no-navigation-without-resolve`

`eslint-plugin-svelte@3` в `recommended` требует оборачивать все внутренние `href`
в `resolve()` из `$app/paths`. С локализованными путями от paraglide это не стыкуется
(`resolve()` ждёт route id). В шаблоне либо выключать с комментарием, либо
переходить на `resolve()` и локализовать уже результат.

### 8.14 Мелочи, стоившие времени

- `svelte({ hot: false })` в `vitest.config.ts` — опции `hot` больше нет.
- ключ `test` в `vite.config.ts` при Vite 8 не типизируется — выносить в `vitest.config.ts`.
- `vitest-axe@0.1.0` не аугментирует типы Vitest 4: нужен свой `vitest-setup.d.ts`
  с `declare module 'vitest' { interface Matchers extends AxeMatchers {} }`
  (без параметра-генерика — у `AxeMatchers` его нет).
- `import.meta.glob(..., { query: { enhanced: true } })` типизируется как
  `Record<string, unknown>` — нужен каст в `Record<string, Picture>`
  (`import type { Picture } from '@sveltejs/enhanced-img'`).
- В `.svelte` обращение к пропсу внутри `const x = map[slug]` даёт
  `state_referenced_locally` — нужен `$derived`.
- `@eslint/js@latest` (10.0.1) требует `eslint ^10`; для ESLint 9 пиннить `@eslint/js@9.39.5`.
- В pnpm-строгом `node_modules` `svelte-eslint-parser`, `globals`, `@eslint/js` надо
  ставить явно.

---

## 9. Что SvelteKit **не** даёт — и что придётся написать самим

| потребность канона | статус | объём самописного |
|---|---|---|
| Кеш HTML в процессе (TTL + SWR + single-flight + `X-Cache`) | **нет из коробки** | `shared/cache/html-cache.ts` — **121 строка**, + 35 строк хука |
| Инвалидация по вебхуку | нет | `+server.ts` с HMAC — **28 строк** |
| `Cache-Control` на HTML | нет (ни на prerendered, ни на SSR) | одна строка в хуке + `setHeaders` в загрузках |
| `sitemap.xml` (в т.ч. `xhtml:link` hreflang) | нет | `shared/seo/feeds.ts` — **~60 строк** |
| `robots.txt` с runtime-политикой | нет | ~15 строк |
| RSS | нет | ~35 строк |
| canonical / hreflang / OG / JSON-LD | нет (есть только `<svelte:head>`) | `shared/seo/meta.ts` + `seo-head.svelte` — **~170 строк** |
| OG-картинки | нет | `scripts/gen-og.mjs` на `sharp` — **~40 строк** (или satori) |
| runtime-config (`SITE_URL`, `ROBOTS_POLICY`) с валидацией | нет | `shared/config` — ~40 строк |
| «Ноль JS» как бюджет | частично (`csr=false` есть, метрики нет) | e2e-тест + `.size-limit.cjs` |
| Bot-aware рендер / отключение стриминга | **не нужно**: при `csr=false` стриминга нет, HTML цельный | 0 |
| i18n-роутинг | закрывается paraglide 2 (`url`-стратегия + `reroute`) | ~15 строк `reroute` + guard `/ru` |
| Контент-коллекции с типизацией | нет (нет аналога Astro Content Layer / Nuxt Content) | `entities/post/api/posts.ts` + Zod — **~40 строк** |
| Пагинация/`entries()` | есть API, логика своя | ~15 строк на маршрут |

Итого «SEO-обвязки» ~**500 строк** проектного кода. Это меньше, чем кажется, и
целиком ложится в `shared/seo` + `shared/cache` + `shared/config`, то есть переживает
`de-template` как готовый фундамент. Но это ровно та часть, которую Nuxt SEO и
Astro-интеграции отдают из коробки.

---

## 10. Вердикт: насколько это грамотно для контент-first сайта в нашей экосистеме

**Оценка по критериям `brief-v2.md`** (веса из 100):

| критерий | вес | оценка | обоснование |
|---|---|---|---|
| Качество выдачи | 25 | **24/25** | Настоящий 0 байт JS по умолчанию — не «мало», а ноль, и в dev тоже. Документ 3–10 КБ raw / 1.2–2.7 КБ gzip. Стриминга нет, значит бот получает цельный HTML. Единственный минус — «пол» 42 КБ gzip, как только странице нужен интерактив. |
| SEO-инструментарий | 20 | **10/20** | Есть только примитивы: `<svelte:head>`, `+server.ts`, честные статусы, `trailingSlash`, `entries()`. Sitemap/robots/RSS/OG/JSON-LD/hreflang — руками. Зато всё, что написал, полностью под контролем и тестируется. |
| Контент-пайплайн | 15 | **9/15** | mdsvex + `import.meta.glob` + Zod работают, HMR 335 мс. Но нет типизированных коллекций, нет loader'ов из CMS, `import.meta.glob(eager)` на большом корпусе — риск (12 постов уже дают 300 КБ мёртвого клиентского чанка). Гибрид static+server per-route — **отличный** (`prerender`/`csr`/`ssr` на любом уровне layout'а). |
| Зрелость и риск | 15 | **12/15** | Svelte 5 / Kit 2 — GA, семвер аккуратный, все пакеты на latest, доки хорошие. Минус — `kit.files` deprecated (наша FSD-раскладка на нём), `enhanced-img` ещё `0.11.0`, paraglide — сторонний проект. |
| Совместимость с наследием | 15 | **13/15** | FSD лёг: `src/pages` как routes, `$lib`=shared, alias `@`, слои и public API. Steiger/Biome/ESLint/Vitest/Playwright/size-limit — все работают с `.svelte`. Минусы — deprecated-конфиг и выключенный `insignificant-slice`. |
| Self-host одним Node-образом | 10 | **9/10** | `adapter-node` — самый честный Node-адаптер из виденных: сам отдаёт статику с `immutable`, предсжатие, 308-нормализация, graceful shutdown, `KEEP_ALIVE_TIMEOUT`/`HEADERS_TIMEOUT` (прямой ответ на риск 502 за Traefik), `BODY_SIZE_LIMIT`, socket activation. Образ 173 МБ, RSS 44–48 МиБ. Минус — нет `Cache-Control` на HTML и нет кеша. |
| **Итого** | 100 | **≈77/100** | |

**Словами.** Для контент-first сайта SvelteKit — очень грамотный выбор **по выдаче и
по рантайму** и посредственный **по SEO-батарейкам**. Он даёт то, чего нет почти ни у
кого: страница без интерактива реально не грузит ни байта JS, а Node-процесс из коробки
ведёт себя как приличный веб-сервер (immutable-кеш, ETag, предсжатие, 308, graceful
shutdown, настраиваемый keep-alive). Взамен он не даёт ни одной SEO-абстракции — весь
`shared/seo` и весь кеш пишутся руками (~500 строк). Для **шаблона** это, парадоксально,
скорее плюс: код, который мы пишем сами, мы же и версионируем, тестируем и переносим в
форк, вместо того чтобы зависеть от чужой интеграции и её мажоров.

Три вещи, которые надо принять как условия:
1. **FSD-раскладка живёт на deprecated `kit.files`** — риск на мажор Kit 3.
2. **Prerender несовместим с рантайм-политиками** (`X-Robots-Tag`, `SITE_URL`), поэтому
   дефолт шаблона — SSR + свой кеш, а не статика.
3. **Барьер гидрации — 42 КБ gzip на страницу**, не «остров». Если проекту нужны 5–10
   интерактивных страниц, это уже заметно, и надо либо жить с этим, либо писать
   интерактив ванильно/вебкомпонентами внутри `csr=false`-страницы.

---

## 11. Открытые вопросы владельцу

1. **`kit.files` deprecated.** Принимаем риск (FSD-имена) или уходим на дефолтные
   `src/routes`/`src/lib` и держим FSD только внутри них? От ответа зависит
   `docs/stack/routing.md` и скилл `/scaffold`.
2. **Дефолтный режим рендера шаблона.** Предлагаю D (SSR + LRU). Нужно ли вообще
   оставлять переключатель `SITE_RENDER_MODE` в шаблоне, или прошить D и документировать
   A/C как «включаемые вручную»?
3. **Staging-noindex при любом prerender** закрывается только на Traefik. Готовы ли
   добавить в `project-infra-template-compose` middleware, который вешает
   `X-Robots-Tag: noindex` на весь staging-роутер?
4. **`eslint-plugin-boundaries` без `import/resolver` молчит — и в текущем
   `spa-frontend-template`.** Это отдельный баг существующего шаблона; чинить сейчас,
   в рамках SSR-шаблона или отдельной задачей?
5. **ESLint 9 vs 10.** `eslint-plugin-svelte@3` совместим с 9.39.5, апгрейд не нужен.
   Но `@eslint/js@latest` уже 10.x — фиксируем `@eslint/js@9` во всех шаблонах?
6. **Biome-стиль для `.svelte`** (неиндентированный `<script>`, `<meta …>` вместо
   `<meta … />`) — принимаем как канон вместо prettier-plugin-svelte?
7. **Markdown как Svelte-компоненты (mdsvex) или как HTML-строка?** Компоненты дают
   интерактив внутри контента, но тянут контент в клиентский граф; строка через
   `render()` из `svelte/server` — чисто, но без компонентов в Markdown.
8. **OG-картинки**: статическая генерация `sharp` на сборке (как в спайке) или
   satori-рендер по запросу с дисковым кешем?

---

## 12. Источники

- https://svelte.dev/docs/kit/configuration — `kit.files` (deprecated), `prerender.entries`, `csrf.trustedOrigins`
- https://svelte.dev/docs/kit/adapter-node — домашняя страница адаптера
- https://svelte.dev/docs/kit/images#sveltejs-enhanced-img — `<enhanced:img>`
- https://svelte.dev/e/state_referenced_locally — предупреждение компилятора Svelte 5
- https://inlang.com/m/gerre34r/library-inlang-paraglideJs · https://paraglidejs.com/strategy#url · https://paraglidejs.com/middleware
- https://www.jsboundaries.dev/docs/releases/migration-guides/v6-to-v7/ — `rules` → `policies`
- https://www.jsboundaries.dev/docs/releases/migration-guides/v5-to-v6/ — `element-types` → `dependencies`, объектные селекторы
- https://biomejs.dev/schemas/2.5.13/schema.json — `html.experimentalFullSupportEnabled`
- https://github.com/feature-sliced/steiger/tree/master/packages/steiger-plugin-fsd/src/insignificant-slice
- https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls — абсолютные canonical (через `14-content-architecture.md` §2.2.2)
- Исходники в `node_modules` (прочитаны напрямую, версии в §2):
  `@sveltejs/adapter-node/{index.js,files/env.js,files/index.js,files/handler.js}`,
  `@sveltejs/kit/types/index.d.ts`, `@sveltejs/kit/src/core/postbuild/prerender.js`,
  `@sveltejs/kit/src/runtime/server/{respond.js,page/index.js,endpoint.js}`,
  `@inlang/paraglide-js/dist/compiler/compiler-options.d.ts`,
  сгенерированный `src/shared/i18n/paraglide/{runtime.js,server.js}`
