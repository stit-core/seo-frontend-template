# 12 — Инструментарий и FSD для контент-first шаблона

Поток **12-tooling-fsd**, раунд 2. Дата: **2026-09-16**.
Лаборатория: `scratchpad/tooling-lab/` (все прогоны воспроизводимы, команды в тексте).
Базовые брифы — `brief.md`, `brief-v2.md`, `ROUND2-CONTEXT.md`.

Пометки: **[эксп]** — проверено собственным прогоном в лаборатории (команда указана);
**[ист]** — проверено по источнику (URL + дата); **[гип]** — предположение, не проверено.

---

## 1. TL;DR

1. **Steiger не годится как единственный сторож FSD в контент-first шаблоне.** Он
   *читает* импорты из `.astro`-frontmatter, `.svelte` (`<script>` и `<script module>`),
   `.vue` (`<script setup>` и обычный `<script>`) — это подтверждено [эксп], — но
   **резолвер (`ts.resolveModuleName`) возвращает `null` для целей `.astro/.svelte/.vue`**,
   поэтому любой импорт *в* файл фреймворка (а это основной способ импортировать
   компонент) выпадает из графа молча. Плюс полностью слепы: клиентские `<script>` в
   `.astro`, файлы `.mts/.cts`, и — главное — **всё, что лежит глубже первого уровня
   слоя `pages`** (подкаталоги маршрутов `blog/`, `en/`, `[slug]/` не индексируются).
2. **Дыры закрывает ESLint**: `eslint-plugin-boundaries@7` (`boundaries/dependencies`) +
   `no-restricted-imports` с групповыми паттернами. В лаборатории эта пара поймала
   **все 100 %** нарушений, которые пропустил Steiger, во всех трёх форматах и во всех
   каталогах маршрутов трёх фреймворков [эксп]. `no-restricted-imports` работает по
   форме спецификатора (без резолва) — поэтому расширение цели ему безразлично.
3. **Роль Steiger переопределяется**: он остаётся как **структурный** линтер (public API,
   сегменты по назначению, зарезервированные имена, опечатки в слоях, «слайс без
   сегментов») + как второй контур для `.ts`-целей. Правила `insignificant-slice`
   в контент-first придётся выключить: референсы из вложенных маршрутов ему не видны.
4. **Biome 2.5.x с `html.experimentalFullSupportEnabled: true` — обязателен.** Без флага
   на трёх форматах получено 12 ложных срабатываний `noUnusedVariables`/`noUnusedImports`
   (использование только в шаблоне), с флагом — 0 ложных, зато появились линт шаблона
   (a11y) и линт клиентского `<script>` в `.astro` [эксп]. `biome format` идемпотентен
   в обоих режимах [эксп]. Единственный конфликт с экосистемой — самозакрывающиеся
   void-элементы; лечится `html.formatter.selfCloseVoidElements: "always"` [эксп].
   Prettier рядом **не нужен**.
5. **ESLint надо поднимать с 9.39.5 до 10.x**: `eslint-plugin-astro@3.2.0` требует
   `eslint >= 10.0.0` [ист npm]. `typescript-eslint@8.70`, `eslint-plugin-vue@10.11`,
   `eslint-plugin-svelte@3.23`, `eslint-plugin-react-hooks@7.1.1`, `@nuxt/eslint@1.17`
   поддерживают `^10`. Единственный «хвост» — `eslint-plugin-jsx-a11y@6.10.2` (peer до
   `^9`), но он ставится и работает под ESLint 10 (pnpm печатает unmet peer) [эксп].
6. **A11y покрывается в каждом формате**: Astro — `astro/jsx-a11y/*` (10 правил
   сработали) [эксп]; Svelte — `svelte/valid-compile: 'error'` поднимает компиляторные
   `a11y_*` предупреждения до ошибок (8 сработали) [эксп]; Vue —
   `eslint-plugin-vuejs-accessibility` (6 сработали) [эксп]. У `eslint-plugin-svelte`
   **своих** a11y-правил нет.
7. **Vitest 5.0.1 работает во всех трёх форматах** [эксп]: `.astro` — через
   `experimental_AstroContainer` в проекте с `environment: 'node'`; `.svelte` —
   `@testing-library/svelte` + обязательный плагин `svelteTesting()` (иначе
   `lifecycle_function_unavailable`); `.vue` — `@vue/test-utils`. A11y — прямым
   `axe-core` (не `vitest-axe`, он заброшен с 2022). Миграция 4→5 нетривиальна:
   убран репортёр `basic`, `clearMocks` теперь `true` по умолчанию, browser-mode
   распался на пакеты-провайдеры.
8. **FSD ложится на контентный сайт хорошо**, но `pages` = каталог маршрутов
   фреймворка, и это не «слайсы»: нужен блок `files: ['src/pages/**']` с выключенными
   `no-layer-public-api` / `no-segmentless-slices` / `no-segments-on-sliced-layers` /
   `public-api` [эксп]. Astro **не умеет** переносить только `pages` (весь `srcDir`
   едет целиком) [ист]; Nuxt умеет (`srcDir` + `dir.pages`) [ист+эксп]; SvelteKit
   умеет через `kit.files.routes`, но **вся секция `kit.files` помечена deprecated** [ист].
9. **`pnpm check` остаётся тем же по составу** (`typecheck → lint → format:check →
   test → steiger → build → size`); меняются только команды typecheck
   (`astro check` / `svelte-kit sync && svelte-check` / `nuxt typecheck`). Новых шагов
   не добавляется — но центр тяжести архитектурной проверки переезжает из
   `pnpm steiger` в `pnpm lint`, и это надо явно записать в `CLAUDE.md` шаблона.
   Самый медленный шаг — ESLint (21 с холодный старт, ~1 с прогретый;
   `--cache` → 0,7 с) [эксп].
10. **Из SPA-стека в контент-first теряют смысл**: React Compiler (если не React),
    TanStack Router/Query/Form (роутинг и данные даёт фреймворк), Zustand (состояние
    в островах локальное), MSW (контент в git — мокать нечего; остаётся только для
    внешних API). Lingui заменяется на встроенный i18n Astro / `@nuxtjs/i18n` /
    `@inlang/paraglide-js`.

---

## 2. Матрица «инструмент × формат»

Прогоны: `tooling-lab/steiger-matrix/` (121 файл, 90 кейсов), `tooling-lab/src/`,
`tooling-lab/biome-exp/`, `tooling-lab/a11y-exp/`, `tooling-lab/fw-layouts/`,
`tooling-lab/vitest-lab/`, `tooling-lab/astro-fsd/`.

| инструмент / возможность | `.ts`/`.tsx` | `.astro` | `.svelte` | `.vue` | `.mts`/`.cts` |
|---|---|---|---|---|---|
| **Steiger** — извлечение импортов | ✅ | ⚠️ только frontmatter | ✅ `<script>` + `<script module>` | ✅ `<script setup>` + `<script>` | ❌ нет экстрактора |
| Steiger — импорт цели `.ts` (deep, cross-slice, вверх) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Steiger — импорт **в** файл `.astro/.svelte/.vue` | ❌ | ❌ | ❌ | ❌ | ❌ |
| Steiger — динамический `import()` | ✅ | ✅ | ✅ | ✅ | ❌ |
| Steiger — клиентский `<script>` в `.astro` | — | ❌ | — | — | — |
| Steiger — структурные правила (public-api, сегменты, имена) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Steiger — `index.<fw>` как public API | — | ⚠️ принимается, но слайс выпадает из графа | ⚠️ то же | ⚠️ то же | — |
| Steiger — файлы маршрутов глубже `src/pages/*` | ❌ | ❌ | ❌ | ❌ | ❌ |
| **ESLint `boundaries/dependencies`** | ✅ | ✅ (+ вирт. `*.astro/*.ts`) | ✅ | ✅ | ✅ |
| **ESLint `no-restricted-imports`** (deep-import) | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Biome** парс/формат/линт (флаг **выкл**) | ✅ | ⚠️ только frontmatter, 🔴 FP | ⚠️ только `<script>`, 🔴 FP | ⚠️ только `<script>`, 🔴 FP | ✅ |
| **Biome** (флаг **вкл**) | ✅ | ✅ script+шаблон+`<style>`+клиентский `<script>` | ✅ script+разметка+`<style>` | ✅ script+template+`<style>` | ✅ |
| **dependency-cruiser 18** | ✅ | ⚠️ поддержки нет, работает случайно | ✅ (svelte/compiler) | ✅ (@vue/compiler-sfc) | ✅ |
| **a11y-линт** | jsx-a11y | ✅ `astro/jsx-a11y/*` | ✅ `svelte/valid-compile` | ✅ `vuejs-accessibility` | — |
| **Vitest 5 компонентный тест** | ✅ | ✅ Container API (env `node`) | ✅ testing-library + `svelteTesting()` | ✅ `@vue/test-utils` | — |
| **typecheck** | `tsc --noEmit` | `astro check` | `svelte-check` | `vue-tsc` / `nuxt typecheck` | `tsc` |
| **knip 6** | ✅ | ⚠️ нужен `compilers` или astro-плагин | ✅ | ✅ | ✅ |

Легенда: ✅ работает · ⚠️ работает частично / с оговоркой · ❌ не работает · 🔴 ложные срабатывания.

### 2.1. Сырые результаты матрицы Steiger

Команда: `cd tooling-lab/steiger-matrix && node gen.mjs && npx steiger src`
(результат — `.out-matrix.txt`, 36 ошибок).

Каждая ячейка — отдельный файл с **ровно одним** импортом; `+` = Steiger выдал диагностику.

```
источник        v1  v2  v3  v4  v5  v6  v7  v8  v9
s-ts             +   +   .   .   .   +   .   +   +
s-mts            .   .   .   .   .   .   .   .   .
s-cts            .   .   .   .   .   .   .   .   .
s-tsx            +   +   .   .   .   +   .   +   +
s-astro-fm       +   +   .   .   .   +   .   +   +     ← frontmatter
s-astro-cli      .   .   .   .   .   .   .   .   .     ← клиентский <script>
s-svelte-in      +   +   .   .   .   +   .   +   +     ← <script lang="ts">
s-svelte-mod     +   +   .   .   .   +   .   +   +     ← <script module lang="ts">
s-vue-setup      +   +   .   .   .   +   .   +   +     ← <script setup lang="ts">
s-vue-plain      +   +   .   .   .   +   .   +   +     ← <script lang="ts">
```

| кейс | импорт | ожидаемое правило |
|---|---|---|
| v1 | `@/features/victim` (цель `index.ts`) | `forbidden-imports` — cross-slice |
| v2 | `@/entities/post/model/schema` (цель `.ts`) | `no-public-api-sidestep` |
| v3 | `@/entities/post/ui/card.astro` | `no-public-api-sidestep` |
| v4 | `@/entities/post/ui/card.svelte` | `no-public-api-sidestep` |
| v5 | `@/entities/post/ui/Card.vue` | `no-public-api-sidestep` |
| v6 | `@/widgets/hero` (цель `index.ts`) | `forbidden-imports` — импорт вверх |
| v7 | `../../victim/ui/thing.svelte` | cross-slice относительным путём |
| v8 | `@/entities/post/ui/card.tsx` | `no-public-api-sidestep` |
| v9 | `() => import('@/entities/post/model/schema')` | динамический deep-import |

**Вывод, ради которого делалась матрица:** разница не в формате *источника*
(все пять «скриптовых зон» разобраны одинаково), а в расширении **цели**.
`.astro/.svelte/.vue` как цель → импорт невидим; `.ts/.tsx/.js/.jsx/.cjs/.mjs` → виден.

---

## 3. Steiger: устройство, экспериментальные факты, слепые зоны

Версии: `steiger@0.6.0`, `@feature-sliced/steiger-plugin@0.7.0` (обе опубликованы
2026-07-14), транзитивно `@feature-sliced/filesystem@3.1.1` [ист npm, 2026-09-16].

### 3.1. Как строится граф (чтение исходников `dist`)

**Экстракторы** — `node_modules/@feature-sliced/steiger-plugin/dist/index.js`, строки 274–380.
Загружаются четыре tree-sitter WASM-парсера из `dist/parsers/`:
`tree-sitter-tsx.wasm` (1,4 МБ), `tree-sitter-svelte.wasm`, `tree-sitter-astro.wasm`,
`tree-sitter-vue.wasm` [эксп: `ls dist/parsers`].

```js
extractors = [
  { type: 'tsx',    extensions: ['.tsx','.jsx','.ts','.js','.cjs','.mjs'], queries: [...4 запроса...] },
  { type: 'svelte', extensions: ['.svelte'], injections: [ (script_element (raw_text) @tsx) ] },
  { type: 'astro',  extensions: ['.astro'],  injections: [ (frontmatter_js_block) @tsx ] },
  { type: 'vue',    extensions: ['.vue'],    injections: [ (document (script_element (raw_text) @tsx)) ] },
]
```

Отсюда — ровно три структурных факта:

- **`.astro`: инъекция только `frontmatter_js_block`.** Клиентские `<script>`-блоки
  Astro в граф не попадают вообще. [эксп: `src/entities/post/ui/post-meta.astro`
  импортирует `@/widgets/hero` и `@/features/contact-form` из клиентского `<script>` —
  Steiger молчит; ESLint ловит оба].
- **`.svelte`: `(script_element (raw_text))` без фильтра по атрибутам** → `<script>`
  и `<script module>` разбираются одинаково. [эксп: `s-svelte-mod` ловится наравне
  с `s-svelte-in`; в `tooling-lab/src/features/search/ui/search.svelte` cross-slice
  импорт объявлен в `<script module lang="ts">` и пойман].
- **`.vue`: `(document (script_element ...))`** → и `<script setup>`, и обычный
  `<script>` на верхнем уровне SFC. [эксп: `s-vue-setup` и `s-vue-plain` одинаковы].

**`.mts`/`.cts` отсутствуют в списке расширений.** В `extractAllDependencies`
на неизвестном расширении есть `throw new Error('No extractor found for ".mts"')`,
но на всех call-site перед этим стоит `const sourceType = getSourceType(path); if
(!sourceType) continue;` — то есть файл **молча пропускается**, без предупреждения.
[эксп: `s-mts`/`s-cts` — нулевая строка в матрице, прогон завершается кодом 1 по
другим ошибкам, про `.mts` не сказано ничего].

**Резолвер** — `@feature-sliced/filesystem@3.1.1`, `dist/index.js:148`:

```js
function resolveImport(importedPath, importerPath, tsCompilerOptions, fileExists, directoryExists) {
  return ts.resolveModuleName(importedPath, importerPath, normalizeCompilerOptions(tsCompilerOptions),
    { ...ts.sys, fileExists, directoryExists }).resolvedModule?.resolvedFileName?.replaceAll('/', sep) ?? null
}
```

TypeScript не знает расширений `.astro/.svelte/.vue`. Прогон `node resolve-probe.mjs`
в лаборатории (TS 6.0.3) [эксп]:

```
### bundler (как в шаблоне)
  @/entities/post                                -> src/entities/post/index.ts
  @/entities/post/ui/post-card.astro             -> NULL
  @/entities/post/ui/post-card.svelte            -> NULL
  @/entities/post/ui/PostCard.vue                -> NULL
  ../../../entities/post/ui/post-card.astro      -> NULL
  @/entities/post/ui/post-card                   -> NULL
### bundler + allowJs           — то же самое
### bundler + allowArbitraryExtensions — то же самое
### node16                      — то же самое

### trace кандидатов для ./post-card.svelte
   File '.../post-card.d.svelte.ts' does not exist.
   File '.../post-card.svelte.ts'  does not exist.
   File '.../post-card.svelte.tsx' does not exist.
   File '.../post-card.svelte.d.ts' does not exist.
   File '.../post-card.svelte.js'  does not exist.
   File '.../post-card.svelte.jsx' does not exist.
  resolved: NULL
```

Трасса показывает единственную теоретическую лазейку: с `allowArbitraryExtensions`
TS ищет `<name>.d.<ext>.ts`. То есть положив рядом с каждым компонентом файл
`post-card.d.svelte.ts` можно заставить резолв сработать. **Не рекомендуется**:
это дублирование дерева ради линтера, ломается при каждом переименовании.

На вызывающей стороне (`dist/index.js:492`, `627`, `688`, `1162`, …) стоит:

```js
const resolvedDependency = resolveDependency(dependency, sourceFile.file.path, tsConfigs, fs.existsSync, fs.existsSync)
if (resolvedDependency === null) { continue }     // ← молчаливый пропуск
const dependencyLocation = sourceFileIndex[resolvedDependency]
if (dependencyLocation === undefined) { continue } // ← второй молчаливый пропуск
```

**Отсюда главный вывод про Steiger: любая неудача резолва = «нарушения нет».**
Это fail-open по дизайну, никакого счётчика «не смог разобрать N импортов» нет.

### 3.2. Какие правила зависят от графа, а какие нет

Полный список правил `@feature-sliced/steiger-plugin@0.7.0` (grep по `dist/index.js`):

| правило | зависит от графа импортов? | включено по умолчанию |
|---|---|---|
| `fsd/forbidden-imports` | **да** | да |
| `fsd/no-public-api-sidestep` | **да** | да |
| `fsd/insignificant-slice` (через `traceSliceReferences`) | **да** | да |
| `fsd/no-cross-imports` | **да** | нет (`disabledRules`) |
| `fsd/no-higher-level-imports` | **да** | нет |
| `fsd/import-locality` | **да** | нет |
| `fsd/public-api` | нет (ФС) | да |
| `fsd/no-layer-public-api` | нет (ФС) | да |
| `fsd/no-segmentless-slices` | нет (ФС) | да |
| `fsd/no-segments-on-sliced-layers` | нет (ФС) | да |
| `fsd/no-reserved-folder-names` | нет (ФС) | да |
| `fsd/segments-by-purpose` | нет (ФС) | да |
| `fsd/shared-lib-grouping` | нет (ФС) | да |
| `fsd/ambiguous-slice-names` | нет (ФС) | да |
| `fsd/inconsistent-naming` | нет (ФС) | да |
| `fsd/repetitive-naming` | нет (ФС) | да |
| `fsd/excessive-slicing` | нет (ФС) | да |
| `fsd/typo-in-layer-name` | нет (ФС) | да |
| `fsd/no-ui-in-app` | нет (ФС) | да |
| `fsd/no-processes` | нет (ФС) | да |

**Ровно три включённых правила из двадцати зависят от графа** — и именно они
деградируют на не-`.ts`-целях. Остальные семнадцать работают с любым форматом,
потому что смотрят только на дерево файлов.

### 3.3. `index.svelte` / `index.vue` / `index.astro` как public API

`@feature-sliced/filesystem` `isIndex()`:

```js
const parsedFileName = parse(fileOrFolder.path).name
return parsedFileName.split('.').at(0) === 'index'
```

→ расширение не проверяется, `index.svelte` **принимается** как public API слайса.

[эксп] В матрице заведены слайсы `features/pub-svelte` (только `index.svelte` + `ui/inner.ts`),
`pub-vue`, `pub-astro` и `features/no-index` (без индекса). Правило `fsd/public-api`
пожаловалось **только** на `no-index`:

```
┌ src/features/no-index
✘ This slice is missing a public API.  ✔ Auto-fixable
```

**Но** потребитель `src/pages/consumer.ts` с `import '@/features/pub-svelte'` не
резолвится (директория с `index.svelte` для TS пуста), и слайс выпадает из графа —
при включённом `insignificant-slice` он числится «без референсов» [эксп]:

```
┌ src/features/pub-astro   ✘ This slice has no references. Consider removing it.
┌ src/features/pub-svelte  ✘ This slice has no references. Consider removing it.
┌ src/features/pub-vue     ✘ This slice has no references. Consider removing it.
```

**Правило для шаблона: public API слайса — всегда `index.ts`** с explicit re-export
компонента (`export { default as PostCard } from './ui/post-card.astro'`). Тогда
внешние импорты `@/entities/post` резолвятся и проверяются, а нерезолвимой остаётся
только внутренняя связь `index.ts → ui/*.astro` (внутри слайса она и не проверяется).
Это ровно то, что уже сделано в спайках.

### 3.4. Слепая зона №1 (критическая): слой `pages` при файловом роутинге

`indexSourceFiles` (`dist/index.js:155`) для **нарезаемого** слоя индексирует только:

1. файлы, лежащие прямо в корне слоя (`layer.children.filter(type === 'file')`);
2. файлы внутри распознанных **сегментов** слайса (`ui/model/api/lib/config`);
3. `index.*` слайса.

Каталог маршрута (`src/pages/blog/`, `src/pages/en/`, `src/pages/blog/[slug]/`)
сегментов не содержит → **всё его содержимое вне индекса → импорты не анализируются**.

[эксп] `tooling-lab/fw-layouts/` — три реалистичных дерева, в каждом одинаковое
нарушение `import ... from '@/entities/post/model/schema'` разложено по разным местам
слоя маршрутов:

| фреймворк | файл | Steiger | ESLint |
|---|---|---|---|
| Astro (`src/pages`) | `src/pages/index.astro` | ✅ поймал | ✅ |
| Astro | `src/pages/robots.txt.ts` | ✅ поймал | ✅ |
| Astro | `src/pages/blog/index.astro` | ❌ **пропустил** | ✅ |
| Astro | `src/pages/blog/[slug].astro` | ❌ **пропустил** | ✅ |
| Nuxt (`src/pages`) | `src/pages/index.vue` | ✅ поймал | ✅ |
| Nuxt | `src/pages/blog/index.vue` | ❌ **пропустил** | ✅ |
| SvelteKit (`src/routes`) | `src/routes/+page.svelte` | ❌ **пропустил** (слой не распознан) | ✅ |
| SvelteKit (`kit.files.routes: 'src/pages'`) | `src/pages/+page.svelte` | ✅ поймал | ✅ |
| SvelteKit (то же) | `src/pages/blog/+page.server.ts` | ❌ **пропустил** | ✅ |
| SvelteKit (то же) | `src/pages/blog/[slug]/+page.svelte` | ❌ **пропустил** | ✅ |
| SvelteKit (то же) | `src/pages/robots.txt/+server.ts` | ❌ **пропустил** | ✅ |

Команды: `cd tooling-lab/fw-layouts/<d> && ../../node_modules/.bin/steiger src`
и `npx eslint --config ../eslint.<fw>.js src`.

Побочный эффект той же дыры: `insignificant-slice` выдаёт ложные «This slice has no
references» на widgets, которые используются только из вложенных маршрутов [эксп] —
в контент-first это **большинство** widgets. Правило придётся выключить.

### 3.5. Слепая зона №2: структурный шум от файлового роутинга

[эксп] Без настройки `steiger src` на дереве Astro/Nuxt даёт:

```
┌ src/pages/index.astro   ✘ Layer "pages" should not have an index file      (fsd/no-layer-public-api)
┌ src/pages/blog          ✘ This slice has no segments.                      (fsd/no-segmentless-slices)
┌ src/pages/en            ✘ This slice has no segments.
┌ src/pages/_components   ✘ This slice has no segments.
```

`isIndex()` не отличает `pages/index.astro` (маршрут `/`) от public API слоя — то же
самое уже лечится в SPA-шаблоне точечным `files: ['src/pages/index.tsx']`.
Для контентного сайта таких файлов много, поэтому выключать нужно на весь `src/pages/**`.

[эксп] Проверено, что `ignores` и `files`-скоуп в `steiger.config.ts` работают
как заявлено: с конфигом из §9.1 остаются только настоящие нарушения:

```
┌ src/entities/post/ui/post-card.astro  ✘ Forbidden import from higher layer "widgets".
┌ src/pages/index.astro                 ✘ Forbidden sidestep of public API ... "@/entities/post/model/schema"
┌ src/pages/robots.txt.ts               ✘ Forbidden sidestep of public API ...
```

а `src/content.config.ts`, `src/middleware.ts`, `src/actions/**`, `src/env.d.ts`
(жёстко навязанные Astro пути) молчат.

Отдельно: `typo-in-layer-name` **не** ругается на `src/actions/`, `src/layouts/`,
`src/lib/`, `src/app.vue`, `src/error.vue`, `src/hooks.server.ts` [эксп] — расстояние
Левенштейна до имён слоёв достаточно велико. Каталоги-«не слои» просто игнорируются.

### 3.6. Открытые issue/PR Steiger по форматам

- PR **#235 «feat: replace precinct with tree-sitter»**, закрыт 2026-05-14 —
  именно он принёс поддержку `.svelte`/`.astro`; в описании прямо сказано, что
  цель — «добавить поддержку Svelte и Astro и сделать парсинг устойчивее».
  <https://github.com/feature-sliced/steiger/pull/235> [ист]
- Issue **#116 «Support Svelte»**, закрыт 2024-10-27 — исходная просьба, упирался
  в `precinct`. <https://github.com/feature-sliced/steiger/issues/116> [ист]
- Issue **#94 «References to features aren't detected in a Nuxt setup»**, закрыт
  2024-08-22 — ровно тот класс проблем, что воспроизведён выше (референсы на `.vue`
  не детектились). <https://github.com/feature-sliced/steiger/issues/94> [ист]
- Issue **#225 `ERR_PACKAGE_PATH_NOT_EXPORTED`**, **открыт** с 2026-03-20 —
  проблема экспортов пакета в Vue-проектах.
  <https://github.com/feature-sliced/steiger/issues/225> [ист]

Отдельного открытого тикета «резолв импортов в `.svelte/.vue/.astro`» не нашлось —
судя по коду, это не считается багом, а просто не реализовано.
**Каденс**: обе публикации (`steiger` 0.6.0 и плагин 0.7.0) — 2026-07-14; проект
живой, но небыстрый. Закладываться на скорое исправление не стоит [гип].

### 3.7. Альтернативы и их экспериментальная проверка

Все три альтернативы проверены на **одних и тех же** фикстурах
(`tooling-lab/src/`), где Steiger ловит 6 ошибок из 12 заложенных.

#### (а) ESLint: `eslint-plugin-boundaries@7.2.0` + `no-restricted-imports` — **рекомендуется**

`npx eslint src` → **17 ошибок**, включая все 6 пропущенных Steiger [эксп]:

```
src/entities/post/ui/post-meta.astro
  8:24  error  ... "entities"/post → "widgets"/hero      boundaries/dependencies   ← клиентский <script>!
  9:37  error  ... "entities"/post → "features"/contact-form  boundaries/dependencies
src/features/contact-form/ui/contact-form.astro
  2:20  error  ... features/contact-form → features/search   boundaries/dependencies  ← относительный путь на .svelte
  3:1   error  '@/entities/post/ui/post-card.astro' ... Deep-импорт мимо public API  no-restricted-imports
src/features/contact-form/ui/contact-form.svelte   — то же
src/features/contact-form/ui/ContactForm.vue       — то же
src/widgets/hero/ui/hero.astro
  2:1   error  '@/entities/post/ui/post-card.astro' ...  no-restricted-imports
```

Ключевые механизмы:

- `boundaries/dependencies` резолвит цель через `eslint-import-resolver-typescript`
  **с расширенным `extensions`** (`.astro/.svelte/.vue` включены) — поэтому
  относительный импорт `.svelte` из `.astro` классифицируется правильно [эксп];
- `no-restricted-imports` **вообще не резолвит** — сравнивает строку спецификатора
  по gitignore-семантике библиотеки `ignore`. Поэтому расширение цели неважно.
  [эксп] Проверено `tooling-lab/nri/`: группа `@/entities/*/*` ловит и
  `@/entities/post/model`, и `@/entities/post/model/schema`, и
  `@/entities/post/ui/card.svelte`. Паттерн из SPA-шаблона `@/*/*/*/*` **не ловит**
  трёхсегментные `@/entities/post/model` — дырка, которую стоит закрыть заодно;
- клиентские `<script>` в `.astro` покрываются процессором `eslint-plugin-astro`,
  который отдаёт их как виртуальные файлы `**/*.astro/*.ts` — нужен отдельный
  конфиг-блок под этот glob (см. §9.2) [эксп].

#### (б) `dependency-cruiser@18.3.1` — рабочая подстраховка, но `.astro` не поддержан

`npx depcruise --info` [эксп]:

```
✔ svelte                >=3.0.0 <6.0.0      svelte/compiler@5.57.0
✔ @vue/compiler-sfc     >=3.0.0 <4.0.0      @vue/compiler-sfc@3.5.42
✔ typescript            >=2.0.0 <7.0.0      typescript@6.0.3
✔ extension: .js .cjs .mjs .jsx .ts .tsx .d.ts .cts .d.cts .mts .d.mts .vue .svelte
```

`.astro` в списке **нет** и `grep -rn astro node_modules/dependency-cruiser/src/`
не даёт ни одного совпадения [эксп]. Импорты из `.astro` всё же иногда извлекаются —
это побочный эффект того, что TypeScript-парсер устойчив к ошибкам и «дожёвывает»
frontmatter; результат нестабилен: в `hero.astro` (где после шаблона есть
клиентский `<script>`) value-импорт `@/entities/post/ui/post-card.astro` потерялся,
а type-импорт `@/entities/post` сохранился [эксп].

С исправленным конфигом (`tooling-lab/.dependency-cruiser-v2.cjs`, **обязательно**
`tsPreCompilationDeps: true`, иначе type-only импорты вырезаются транспиляцией)
получено 12 ошибок, поймано всё «свелто-вьюшное», что пропустил Steiger [эксп].
Ограничения, которые надо знать:

- `safe-regex` отвергает правила с lookahead и опциональными группами —
  `has an unsafe regular expression. Bailing out.` Правила пришлось переписать
  без `(?!...)` [эксп];
- `.astro` — не поддержан, значит для Astro-шаблона dependency-cruiser бесполезен;
- `.mts`/`.cts` **поддержаны** (в отличие от Steiger).

**Вердикт:** брать только в SvelteKit/Nuxt-ветке и только как необязательный
дополнительный таргет; для Astro — нет.

#### (в) `eslint-plugin-import-x@4.17.1`

Peer `eslint ^8.57 || ^9 || ^10` [ист npm]. Даёт `import-x/no-restricted-paths`
с зонами — альтернативная запись слоёв FSD. Но: резолв тот же, что у boundaries,
а выразительность для «cross-slice внутри слоя» ниже (нет capture-переменных).
**Не нужен**, если взят `boundaries@7`. Полезен один его сосед — `import-x/no-cycle`
(циклы между слайсами), которого нет ни у Steiger, ни у boundaries. [гип: стоимость
маленькая, ценность средняя — решение владельца.]

#### (г) `knip@6.36.0`

[эксп] Прогон на лабораторных фикстурах: находит неиспользуемые файлы и devDependencies,
но выдаёт подсказку `«.astro» Extension in project not registered as a compiler` —
для Astro нужен либо авто-детект через `astro.config.*` (в реальном проекте он есть),
либо ручной `compilers`. **Границы FSD knip не проверяет** — это другой инструмент
(мёртвый код, неиспользуемые экспорты и зависимости). Рекомендуется как **отдельный
необязательный скрипт `pnpm knip`**, не в `pnpm check` (высокий шум на шаблоне
с reference-слайсами).

### 3.8. Итог по §3: разделение ответственности

| что проверяем | чем |
|---|---|
| Направление импортов между слоями | **ESLint `boundaries/dependencies`** (основной) + Steiger `forbidden-imports` (второй контур, только `.ts`-цели) |
| Cross-slice внутри слоя | **ESLint `boundaries/dependencies`** (capture `slice`) + Steiger |
| Deep-import мимо public API | **ESLint `no-restricted-imports`** (основной, не зависит от резолва) + Steiger `no-public-api-sidestep` |
| Наличие public API у слайса, сегменты, имена, зарезервированные папки | **Steiger** (единственный, кто это умеет) |
| Мёртвый код и неиспользуемые зависимости | `knip` (опционально, вне гейта) |
| Циклы | `import-x/no-cycle` (опционально) |

`pnpm steiger` остаётся в гейте — он ничего не стоит (0,8–1,0 с на 121 файле [эксп])
и закрывает структурный класс правил, которого нет больше нигде.
</content>
</invoke>

---

## 4. Biome 2.5.x и форматы фреймворков

Версия в лаборатории — `@biomejs/biome@2.5.13`; на 2026-09-16 последняя — **2.5.14**
(опубликована в тот же день) [ист npm].

### 4.1. Официальная матрица

<https://biomejs.dev/internals/language-support/> [ист, 2026-09-16]:

| язык | parsing | formatting | linting | plugins |
|---|---|---|---|---|
| JavaScript / TypeScript / JSX / TSX | ✅ | ✅ | ✅ | ✅ |
| HTML | ✅ | 🟡 | ✅ | 🚫 |
| **Vue** | 🟡 | 🟡 | 🟡 | 🚫 |
| **Svelte** | 🟡 | 🟡 | 🟡 | 🚫 |
| **Astro** | 🟡 | 🟡 | 🟡 | 🚫 |
| CSS | ✅ | ✅ | ✅ | ✅ |
| Markdown, YAML, SCSS | ⌛️ | ⌛️ | 🚫 | 🚫 |

Легенда с той же страницы: «✅ Supported, 🚫 Not in progress, ⌛️ In progress,
🟡 Experimental». Текст: «Biome is able to format and lint the HTML, CSS and
JavaScript parts of the files», «this support must be considered experimental
and subject to changes and improvements».

История: полная поддержка Vue/Svelte/Astro приехала в **Biome 2.3** под флагом
`html.experimentalFullSupportEnabled`; в **2.5.2** починили
`noUnusedImports`/`noUnusedVariables`/`noUnusedFunctionParameters`/`useImportType`
для биндингов, используемых только в шаблоне (теги компонентов, интерполяции
атрибутов, директивы, `bind:`-сокращения, параметры snippet'ов) [ист:
<https://biomejs.dev/blog/biome-v2-3/>, changelog 2.5.2].

**Roadmap по этим форматам отдельной страницей не публикуется**; статус 🟡 стоит
на всех трёх, флаг называется `experimental*`. [гип] Полагаться на то, что флаг
станет умолчанием к моменту релиза шаблона, нельзя — закладываем явный флаг в
`biome.json` и фиксируем минорную версию Biome.

### 4.2. Эксперимент: флаг выключен vs включён

`tooling-lab/biome-exp/{off,on}` — одинаковые 7 файлов (три простых `a.astro`/
`b.svelte`/`c.vue` + три «тяжёлых» из `biome-hard/`), конфиги отличаются **одной
строкой**. Команда: `biome lint . --reporter=summary`.

**Флаг ВЫКЛЮЧЕН — 12 предупреждений, все ложные** [эксп]:

```
lint/correctness/noUnusedVariables   9 (9 warnings)
lint/correctness/noUnusedImports     3 (3 warnings)

a.astro:2:8   noUnusedImports     ← cn импортируется и используется в шаблоне
a.astro:3:9   noUnusedVariables   ← x используется в data-x={x}
b.svelte:2:10 noUnusedImports
b.svelte:3:11 noUnusedVariables
c.vue:2:8     noUnusedImports
c.vue:3:9     noUnusedVariables
post-list.astro:3:7  noUnusedVariables  ← posts.map(...) в шаблоне
post-list.astro:4:9  noUnusedVariables  ← lang в шаблонной строке
search.svelte:5:9    noUnusedVariables  ← $derived, используется в {#each}
```

**Флаг ВКЛЮЧЁН — 4 ошибки + 3 предупреждения, ложных нет** [эксп]:

```
lint/a11y/useAltText                  3 (3 errors)
lint/suspicious/useIterableCallbackReturn  1 (1 error)
lint/correctness/noUnusedVariables    3 (3 warnings)   ← все три настоящие (`let unused = 2`)

post-list.astro:11:7   a11y/useAltText                    ← <img> в шаблоне .astro
post-list.astro:19:34  suspicious/useIterableCallbackReturn ← КЛИЕНТСКИЙ <script> .astro
ProductCard.vue:12:5   a11y/useAltText                    ← <template> Vue
search.svelte:22:1     a11y/useAltText                    ← разметка Svelte
```

Два вывода:

1. **Флаг убирает 9 ложных срабатываний из 12 и не создаёт новых** — без него
   пришлось бы глушить `noUnusedVariables`/`noUnusedImports` на всём проекте,
   то есть терять их и в `.ts`.
2. **Флаг добавляет покрытие, которого нет у Steiger**: разметка (a11y) и
   клиентские `<script>` в `.astro`.

### 4.3. Форматирование: идемпотентность и конфликты

`biome format --write .` дважды подряд, сравнение прогонов [эксп]:

```
format --write (off), проход 1: Fixed 5 files    проход 2: No fixes applied  → ИДЕМПОТЕНТНО
format --write (on),  проход 1: Fixed 6 files    проход 2: No fixes applied  → ИДЕМПОТЕНТНО
```

Что делает флаг при форматировании (diff `off` → `on`) [эксп]:

- форматирует **разметку** (`<div    class=…>` → `<div class=…>`, отступы);
- форматирует `<style>` (`.a    { color:   red; }` → многострочный блок);
- форматирует клиентский `<script>` в `.astro`;
- в `.astro` добавляет пустую строку после закрывающего `---`;
- **`<img … />` → `<img …>`, `<input … />` → `<input …>`** — единственный
  содержательный конфликт.

Реальный «боевой» `.astro` (`biome-hard/post-list.astro` — `getCollection`,
`posts.map` с JSX, `set:html`, шаблонные строки, клиентский `<script>`) **не
изменился ни в одном режиме** [эксп] — форматтер консервативен.

**Конфликты с экосистемой и как их снять** (все опции проверены по
`configuration_schema.json` пакета и прогоном [эксп]):

| конфликт | лечение |
|---|---|
| `eslint-plugin-vue` → `vue/html-self-closing` требует `<img />`; Biome убирает `/` | `html.formatter.selfCloseVoidElements: "always"` — после этого `search.svelte` и `ProductCard.vue` возвращаются к исходному виду, diff пустой [эксп] |
| `prettier-plugin-svelte` пишет `/>` у void-элементов | то же |
| `<script setup>` в Vue по конвенции не индентируется, в Svelte — индентируется | `overrides` по расширению: `[{ "includes": ["**/*.vue"], "html": { "formatter": { "indentScriptAndStyle": false } } }]` — проверено, override применяется [эксп] |

Полный список опций `html.formatter` (из схемы 2.5.13): `attributePosition`,
`bracketSameLine`, `enabled`, `indentScriptAndStyle`, `indentStyle`, `indentWidth`,
`lineEnding`, `lineWidth`, **`selfCloseVoidElements`** (`"never" | "always"`),
`trailingNewline`, `whitespaceSensitivity` (`"css" | "strict" | "ignore"`).
`html.parser` — `interpolation` и `vue` (только для `.html`-файлов; на
`.vue/.svelte/.astro` не влияют). `html.linter.enabled`.

### 4.4. Нужен ли Prettier рядом

**Нет.** Единственная причина держать Prettier была бы в «фирменном» форматировании
шаблонов (`prettier-plugin-astro@1.0.0` вышел 2026-09-08, `prettier-plugin-svelte@4.1.1`)
[ист npm]. Биom с флагом форматирует шаблоны идемпотентно и без конфликтов
после `selfCloseVoidElements: "always"`. Держать два форматтера на пересекающихся
расширениях — гарантированная война правок в pre-commit.

Если владелец всё же захочет Prettier для `.astro`/`.svelte` — **разделять строго
по расширениям**, `biome.json#files.includes` исключает эти расширения, а
`.prettierignore` исключает всё остальное. Это дороже и медленнее; рекомендация —
не делать.

**`format:check`** остаётся `biome format .` (как в SPA-шаблоне): команда ничего не
пишет и падает при расхождении. В спайках `format:check` был `biome check .` —
это смешивает линт и формат; в шаблоне разделение лучше (`lint` = `biome check . &&
eslint .`, `format:check` = `biome format .`).

---

## 5. ESLint flat: версии, зрелость, typed-lint, a11y

### 5.1. Реестр версий (npm, проверено 2026-09-16)

| пакет | latest | опубликован | peer `eslint` | прочие peers |
|---|---|---|---|---|
| `eslint` | **10.10.0** | 2026-09-04 | — | node `^20.19 \|\| ^22.13 \|\| >=24` |
| `@eslint/js` | 10.0.1 | 2026-02-06 | `^10.0.0` | — |
| `typescript-eslint` | 8.70.0 | 2026-09-07 | `^8.57 \|\| ^9 \|\| ^10` | `typescript >=4.8.4 <6.1.0` |
| `@typescript-eslint/parser` | 8.70.0 | 2026-09-07 | `^8.57 \|\| ^9 \|\| ^10` | то же |
| **`eslint-plugin-astro`** | **3.2.0** | 2026-09-16 | **`>=10.0.0`** | `typescript-eslint >=8.61`, `@typescript-eslint/parser >=8.61`, `eslint-plugin-jsx-a11y >=6.10.2` **или** `eslint-plugin-jsx-a11y-x >=0.2.0` (оба optional) |
| `astro-eslint-parser` | 3.1.0 | 2026-08-13 | — | node `^22.22.3 \|\| ^24.16 \|\| >=26.3` |
| `eslint-plugin-svelte` | 3.23.0 | 2026-08-13 | `^8.57.1 \|\| ^9 \|\| ^10` | `svelte ^3.37 \|\| ^4 \|\| ^5` |
| `svelte-eslint-parser` | 1.8.1 | 2026-08-15 | — | `svelte ^3.37 \|\| ^4 \|\| ^5` |
| `eslint-plugin-vue` | 10.11.0 | 2026-09-06 | `^8.57 \|\| ^9 \|\| ^10` | `vue-eslint-parser ^10.3`, `@typescript-eslint/parser ^7 \|\| ^8` |
| `vue-eslint-parser` | 10.4.1 | 2026-06-02 | `^8.57 \|\| ^9 \|\| ^10` | — |
| `@nuxt/eslint` | 1.17.0 | 2026-08-06 | `^9.0.0 \|\| ^10.0.0` | — |
| `eslint-plugin-vuejs-accessibility` | 2.6.0 | 2026-08-10 | `^5…^10` | `globals >= 13.12.1` |
| `eslint-plugin-boundaries` | 7.2.0 | 2026-08-09 | `>=6.0.0` | — |
| `eslint-plugin-import-x` | 4.17.1 | 2026-06-28 | `^8.57 \|\| ^9 \|\| ^10` | `@typescript-eslint/utils ^8.56` |
| `eslint-import-resolver-typescript` | 4.4.5 | 2026-06-01 | `*` | — |
| **`eslint-plugin-jsx-a11y`** | 6.10.2 | **2024-10-26** | **`^3…^9`** (нет `^10`) | — |
| `eslint-plugin-jsx-a11y-x` | 0.2.0 | 2026-05-10 | `^9 \|\| ^10` | — |
| `eslint-plugin-react-hooks` | 7.1.1 | 2026-04-17 | `^3…^10` | — |

### 5.2. Нужен ли апгрейд гейта на ESLint 10

**Да — для Astro-ветки обязательно** (`eslint-plugin-astro@3.x` не поставится и не
запустится под ESLint 9). Для SvelteKit/Nuxt — необязательно, но желательно:
плагины уже объявляют `^10`, а `@eslint/js@10.0.1` (который уже стоит в
SPA-шаблоне!) peer-требует `eslint ^10.0.0` — сейчас в шаблоне `eslint: ^9.20.0`,
то есть peer уже нарушен.

Что ломается при 9 → 10 в *SPA*-шаблоне (для оценки цены общего апгрейда):

- `typescript-eslint@8.70` — поддерживает `^10` [ист npm] ✅
- `eslint-plugin-react-hooks@7.1.1` — поддерживает `^10` [ист npm] ✅
- `eslint-plugin-react@7.37`, `eslint-plugin-jsx-a11y@6.10.2`,
  `eslint-plugin-testing-library@7` — peer до `^9`. jsx-a11y **работает** под 10
  (проверено на Astro-конфиге: 10 правил отработали) [эксп], но pnpm пишет:
  ```
  └── ✕ unmet peer eslint@"^3 || ^4 || … || ^9": found 10.10.0
  ```
  → потребуется `pnpm.peerDependencyRules.allowedVersions` или замена на
  `eslint-plugin-jsx-a11y-x@0.2.0` (peer `^9 || ^10`).
- В ESLint 10 `jiti` стал peer-зависимостью (`"jiti": "*"`) — для TS-конфигов
  (`eslint.config.ts`) его надо ставить явно. У нас конфиг `.js` — не касается.

[гип] Оценка: апгрейд ESLint 10 в SSR-шаблоне — обязателен и дёшев (конфиг flat
уже); в SPA-шаблоне — отдельная задача, здесь не решается.

### 5.3. Typed-lint (`parserOptions.projectService`) в компонентных файлах

| формат | typed-lint | как |
|---|---|---|
| `.ts/.tsx` | ✅ | `projectService: true` как в SPA-шаблоне |
| `.astro` | ⚠️ | `astro-eslint-parser` + `parserOptions.parser: tseslint.parser` + `extraFileExtensions: ['.astro']`; требует, чтобы `.astro` попадал в tsconfig `include` |
| `.svelte` | ⚠️ | `svelte-eslint-parser` + `parserOptions.parser` + `extraFileExtensions: ['.svelte']`; отдельно `.svelte.ts`/`.svelte.js` (runes-модули Svelte 5) |
| `.vue` | ⚠️ | `vue-eslint-parser` + `parserOptions.parser` + `extraFileExtensions: ['.vue']` |

[гип, не проверено в лаборатории] Typed-правила (`recommendedTypeChecked`) на
компонентных файлах — источник заметного замедления и «шума» на сгенерированных
типах фреймворков (`.astro/types.d.ts`, `.svelte-kit/`, `.nuxt/`). **Рекомендация
для шаблона**: `recommendedTypeChecked` включать только на `**/*.{ts,mts,cts}`
(логика слайсов), а на компонентных файлах — базовый `recommended` + FSD-правила
+ a11y. Настоящая типовая проверка компонентов и так делается отдельным шагом
(`astro check` / `svelte-check` / `vue-tsc`), который понимает шаблоны глубже, чем
`typescript-eslint`.

### 5.4. A11y — проверено на одинаковой «злой» разметке

Фикстуры `tooling-lab/a11y-probe/` (один и тот же набор нарушений в `.astro`,
`.svelte`, `.vue`): `<img>` без alt, пустой `<a href="#">`, `<div onclick>`,
`tabindex="5"`, `<input>` без label, `<marquee>`, `<iframe>` без title.

**Astro** — `eslint-plugin-astro@3.2.0` + `eslint-plugin-jsx-a11y@6.10.2`,
конфиги `flat/recommended` + `flat/jsx-a11y-recommended` → **10 ошибок** [эксп]:

```
astro/jsx-a11y/html-has-lang, alt-text, anchor-has-content, anchor-is-valid,
click-events-have-key-events, no-static-element-interactions,
no-noninteractive-tabindex, tabindex-no-positive, no-distracting-elements,
iframe-has-title
```

⚠️ **Ловушка**: `eslint-plugin-astro` загружает jsx-a11y «из юзерского локала»
(`requireUserLocal('eslint-plugin-jsx-a11y')`, `lib/index.mjs:3394`). Если пакет
не установлен, конфиг `flat/jsx-a11y-recommended` **разворачивается в ноль правил
и молчит** — прогон даёт 0 проблем и выглядит зелёным [эксп: до установки
jsx-a11y конфиг содержал `rules: [] (0)`]. Обязательно ставить peer явно и
иметь хотя бы один негативный тест.

**Svelte** — своих a11y-правил у `eslint-plugin-svelte` **нет**
(`Object.keys(plugin.rules).filter(/a11y/)` → пусто [эксп]). A11y даёт компилятор
Svelte 5; поднять до ошибок — правилом `svelte/valid-compile: 'error'`.
[эксп] На `simple.svelte` — **8 ошибок**, ровно совпадающих с `svelte.compiler.compile().warnings`:

```
a11y_missing_attribute (img), a11y_consider_explicit_label (a),
a11y_invalid_attribute (href="#"), a11y_click_events_have_key_events,
a11y_no_static_element_interactions, a11y_no_noninteractive_tabindex,
a11y_positive_tabindex, a11y_missing_attribute (iframe)
```

⚠️ Ловушка: если компилятор падает на **синтаксисе/семантике** раньше
(в моей первой фикстуре был `<body>` — «Special body element is deprecated in v5»),
`valid-compile` отдаёт только эту ошибку, а a11y-проверки не выполняются [эксп].

**Vue** — `eslint-plugin-vuejs-accessibility@2.6.0`, `flat/recommended` →
**6 ошибок** [эксп]: `alt-text`, `anchor-has-content`, `tabindex-no-positive`,
`form-control-has-label`, `no-distracting-elements`, `iframe-has-title`.

**Biome** (флаг вкл) даёт третий, независимый контур: `a11y/useAltText`
сработал во всех трёх форматах [эксп]. Перекрытие частичное, дублирование
безвредно.

### 5.5. `no-restricted-imports` — точная семантика (важно для конфига)

ESLint сопоставляет `patterns[].group` по правилам библиотеки `ignore`
(gitignore-подобные): `*` не пересекает `/`, а паттерн без завершающего `/`
матчит и сам путь, **и всё, что под ним**.

[эксп] `tooling-lab/nri/`, ESLint 10.10:

| импорт | `@/entities/*/*` | `@/*/*/*` + `!@/shared/*/*` | `@/*/*/*/*` (SPA-шаблон) |
|---|---|---|---|
| `@/entities/post` | — | — | — |
| `@/entities/post/model` | 🔴 ловит | 🔴 ловит | — **дыра** |
| `@/entities/post/model/schema` | 🔴 | 🔴 | 🔴 |
| `@/entities/post/ui/card.svelte` | 🔴 | 🔴 | 🔴 |
| `@/shared/lib` | — | — | — |
| `@/shared/ui/button` | — | — | — |
| `@/shared/ui/button/inner` | — | — | 🔴 |

Итоговая рекомендуемая форма (проверена целиком [эксп] — ловит ровно 4 нарушения
из 10 импортов, ни одного ложного):

```js
'no-restricted-imports': ['error', { patterns: [
  { group: ['@/entities/*/*', '@/features/*/*', '@/widgets/*/*', '@/pages/*/*'],
    message: 'FSD: импорт мимо public API слайса' },
  { group: ['@/shared/*/*', '!@/shared/ui/*', '!@/shared/lib/*', '@/shared/ui/*/*', '@/shared/lib/*/*'],
    message: 'FSD: импорт мимо public API сегмента shared' },
]}]
```

Известное расхождение со Steiger: `@/shared/lib/cn` этой формой **разрешён**
(Steiger такое пометит). Либо принять соглашение «в `shared/lib` — папка на
утилиту с `index.ts`» (тогда расхождения нет), либо добавить третью группу.

### 5.6. `eslint-plugin-boundaries` v5 → v7 (миграция с SPA-шаблона)

SPA-шаблон использует v5-API: `boundaries/element-types` + `settings['boundaries/elements']`
с `pattern: 'src/<layer>/*'`. В v7 правило `element-types` ещё есть, но
**рекомендуется `boundaries/dependencies`** с `policies` (поддерживает
capture-переменные `{{from.slice}}`, чего не хватало для cross-slice).

Предупреждения, которые печатает v7.2.0 [эксп] — их надо снять в шаблоне:

```
[boundaries][warning]: The 'mode' option in element descriptors is deprecated…
  Use 'partialMatch: false' instead of 'mode: "full"'. Remove 'mode: "folder"'.
[boundaries][warning]: Detected legacy template syntax ${...} in the rule's general 'message'.
  Consider migrating to {{...}} syntax.
```

Полный список правил v7: `entry-point`, `element-types`, `dependencies`, `external`,
`no-ignored-dependencies`, `no-ignored`, `no-private`, `no-unknown-dependencies`,
`no-unknown`, `no-unknown-files` [эксп].

---

## 6. Vitest 5: тесты компонентов каждого формата

Версии на 2026-09-16 [ист npm]: `vitest@5.0.1` (2026-09-15, peer `vite ^6.4 || ^7 || ^8`,
node `^22.12 || ^24 || >=26`), `@vitest/coverage-v8@5.0.1`, `@vitest/browser@5.0.1`
плюс **отдельные пакеты-провайдеры** `@vitest/browser-playwright@5.0.1`,
`@vitest/browser-preview@5.0.1`, `@vitest/browser-webdriverio`.

### 6.1. Astro — `experimental_AstroContainer`, проверено

Проект `tooling-lab/astro-fsd/` (`astro@7.3.2`, `vitest@5.0.1`, `happy-dom@20.14.5`,
`axe-core@4.13.0`, `typescript@6.0.3`). `npx vitest run` → **3 passed** [эксп].

`vitest.config.ts` — ключевой момент — **два проекта** с разными окружениями:

```ts
import { getViteConfig } from 'astro/config'

export default getViteConfig({
  test: {
    globals: true,
    projects: [
      {
        // .astro рендерится Container API только в node-окружении:
        // в браузерных условиях astro-плагин отдаёт заглушку-ошибку.
        extends: true,
        test: { name: 'astro', environment: 'node',
                include: ['src/**/*.astro.test.ts', 'src/**/*.server.test.ts'] },
      },
      {
        extends: true,
        test: { name: 'dom', environment: 'happy-dom', include: ['src/**/*.test.ts'],
                exclude: ['src/**/*.astro.test.ts', 'src/**/*.server.test.ts'] },
      },
    ],
  },
})
```

Тест компонента:

```ts
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { expect, test } from 'vitest'
import PostCard from './post-card.astro'

test('рендерит заголовок и ссылку', async () => {
  const container = await AstroContainer.create()
  const html = await container.renderToString(PostCard, { props: { title: 'Пост', href: '/blog/post' } })
  expect(html).toContain('Пост')
  expect(html).toContain('href="/blog/post"')
})
```

A11y-тест: рендерим в строку, вставляем в `happy-dom` Window, гоняем `axe-core`.
**Обязательная деталь** [эксп]: изолированный фрагмент всегда даёт нарушение
`region` («Some page content is not contained by landmarks») — для компонентного
теста это правило надо выключать:

```ts
const results = await axe.run(window.document.body as unknown as Element, {
  rules: { region: { enabled: false } },   // фрагмент вне <main>
})
expect(results.violations).toEqual([])
```

**`vitest-browser-astro@0.2.0` брать нельзя**: peers `astro ^5.x`, `vite ^6.x`,
`vitest ^4.x`, публикация 2026-02-20 [ист npm] — несовместим с Astro 7 / Vitest 5.

### 6.2. Svelte 5 — `@testing-library/svelte` + обязательный `svelteTesting()`

Проект `tooling-lab/vitest-lab/` (`vitest@5.0.1`, `svelte@5.57.0`,
`@sveltejs/vite-plugin-svelte@7.3.0`, `@testing-library/svelte@5.4.2`,
`happy-dom@20.14.5`). `npx vitest run` → **2 passed** [эксп].

**Ловушка №1** [эксп]: без плагина `svelteTesting()` `render()` падает

```
Svelte error: lifecycle_function_unavailable
`mount(...)` is not available on the server
 ❯ Module.mount node_modules/svelte/src/index-server.js:25:4
```

— резолвится серверная сборка `svelte`. Плагин `svelteTesting()` из
`@testing-library/svelte/vite` выставляет `resolve.conditions` на браузерные.

**Ловушка №2** [эксп]: `<img src="/cover.png">` в `.vue`/`.svelte` компилируется в
импорт ассета; в тестовом прогоне Vite его резолвит и падает
(`Failed to resolve import "/cover.png"`). Нужен реальный файл в `publicDir`
либо `test.alias` на заглушку.

Рабочий конфиг:

```ts
import { svelteTesting } from '@testing-library/svelte/vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [svelte(), vue(), svelteTesting()],
  test: { globals: true, environment: 'happy-dom', include: ['src/**/*.test.ts'] },
})
```

Альтернатива для browser-mode — `vitest-browser-svelte@3.1.0` (peer `vitest ^4 || ^5`)
[ист npm]; в Vitest 5 его `render()` стал **async** (см. §6.5). Для гейта шаблона
browser-mode избыточен: он тянет браузер в `pnpm check`.

### 6.3. Vue — `@vue/test-utils@2.5.1`

[эксп] `mount()` + `axe.run(w.element)` — работает без дополнительных плагинов,
кроме `@vitejs/plugin-vue`. Для Nuxt-специфики (`useAsyncData`, автоимпорты,
`<NuxtLink>`) есть `@nuxt/test-utils@4.3.2` (peer `vitest ^4 || ^5`,
`@vue/test-utils ^2.4.2`, `happy-dom >=20.0.11`, `jsdom >=27.4.0`) [ист npm] —
он поднимает настоящий Nuxt-контекст, но заметно дороже; в гейте разумно держать
«чистые» компонентные тесты на `@vue/test-utils`, а nuxt-интеграции — в e2e.

### 6.4. A11y: `vitest-axe` или `axe-core`

`vitest-axe@0.1.0` опубликован **2022-10-21** [ист npm], без exports-map (SPA-шаблон
уже импортирует матчер по dist-пути с комментарием-костылём). В новой лаборатории
использован **прямой `axe-core@4.13.0`** — работает во всех трёх форматах, даёт
полный контроль над `rules`, не требует расширения `expect`.

**Рекомендация**: в SSR-шаблоне отказаться от `vitest-axe`, завести собственный
хелпер в `src/shared/lib/testing/`:

```ts
import axe from 'axe-core'

export async function expectNoA11yViolations(el: Element) {
  const { violations } = await axe.run(el, { rules: { region: { enabled: false } } })
  if (violations.length > 0) {
    throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join('\n'))
  }
}
```

### 6.5. Миграция Vitest 4 → 5 (SPA-шаблон на 4.1.x)

Источник: <https://vitest.dev/guide/migration> [ист, 2026-09-16]. Что реально
задевает наши шаблоны:

- **Требования**: Vite >= 6.4.0, Node >= 22.12.0.
- **`clearMocks` по умолчанию `true`** — история моков чистится перед каждым
  тестом; вернуть — `clearMocks: false`.
- **Репортёр `basic` удалён** [эксп: `--reporter=basic` → `Error: Failed to load
  custom Reporter from basic`]. Использовать `default`/`verbose`/`dot`.
- **`testNamePattern`** матчится по полному имени, склеенному через `' > '`
  (влияет на `-t`).
- **`extends: true` по умолчанию** для inline-проектов; включён `sharedViteServer`.
- **Удалены**: `test.sequential`/`describe.sequential` (→ `concurrent: false`),
  `benchmark.reporters`/`outputFile`/`compare`, `bench()` на уровне модуля,
  entry-points `vitest/coverage`, `vitest/reporters`, `vitest/environments`,
  `vitest/snapshot`, `vitest/runners`, `vitest/suite`.
- **Мокинг**: `vi.mock()`, `vi.unmock()`, `vi.hoisted()` теперь **обязаны** быть
  на верхнем уровне — вложенные вызовы бросают. (Затронет MSW-обвязку, если она
  переезжает.)
- **Ассерты**: незаэвейченные `resolves`/`rejects`/`toMatchFileSnapshot` теперь
  роняют тест; `toThrow("")` матчит любое сообщение.
- **Артефакты** переехали в единый каталог `.vitest/` (`.vitest/json/output.json`,
  `.vitest/junit/output.xml`, `.vitest/attachments/`) — поправить `.gitignore` и CI.
- **Coverage**: glob-пороги больше не наследуют `perFile`; include/exclude матчатся
  по относительным путям без «contains».
- **Browser mode**: локаторы строгие по умолчанию, `toHaveTextContent` — строгое
  равенство (для подстроки — новый `toMatchTextContent`), `render()` в
  `vitest-browser-vue`/`vitest-browser-svelte` стал **async**, `browser.api` →
  верхнеуровневый `api`.
- **Депрекейты пакетов**: `@vitest/runner`, `@vitest/ws-client` не поддерживаются;
  `@vitest/expect` влит в `vitest`.

[гип] Для нового SSR-шаблона всё это — «писать сразу под 5», цена нулевая.
Для SPA-шаблона миграция 4→5 — отдельная задача среднего размера.

### 6.6. Тест схемы контента (Zod по `.md`)

[эксп] В `astro-fsd` схема проверяется обычным unit-тестом:

```ts
const PostSchema = z.object({ title: z.string().min(1), pubDate: z.coerce.date() })
test('схема контента отбрасывает пустой заголовок', () => {
  expect(PostSchema.safeParse({ title: '', pubDate: '2026-01-01' }).success).toBe(false)
})
```

Для проверки **реального** контента (все `.md` в `entities/*/content/` проходят
схему) есть два пути:

- **Astro**: схема уже объявлена в `src/content.config.ts`; невалидный frontmatter
  роняет `astro build`/`astro check`. Отдельный vitest-тест нужен только на
  «чистую» схему (см. выше). [гип: дублировать полную проверку в vitest
  нецелесообразно].
- **SvelteKit/Nuxt**: контент читается самим приложением (mdsvex / `@nuxt/content`),
  поэтому полезен тест, который через `import.meta.glob('.../content/**/*.md', { eager: true, query: '?raw' })`
  + `gray-matter` парсит frontmatter каждого файла и прогоняет через Zod. [гип,
  в лаборатории не прогонялось; в `spike-sveltekit` `gray-matter@4.0.3` уже стоит].

### 6.7. Что уходит в Playwright, а не в Vitest

- рендер целой страницы и её `<head>` (canonical/hreflang/OG/JSON-LD) — только e2e;
- «ноль JS на странице без островов» — считается по сетевым ответам;
- коды ответов (301/404/410), заголовки `Cache-Control`, `X-Robots-Tag`;
- `curl -A Googlebot`-эквивалент (контент до гидрации);
- a11y целой страницы — `@axe-core/playwright@4.13.0`.

---

## 7. Playwright 1.63, size-limit, lefthook, commitlint, TS strict

### 7.1. Playwright 1.63.0 [ист npm, 2026-09-04; node >= 20]

`webServer` поднимается на **prod-сборке**, а не на dev-сервере. Команда старта
различается:

| фреймворк | команда `start` | healthcheck-url |
|---|---|---|
| Astro + `@astrojs/node@11.1.5` | `node ./dist/server/entry.mjs` | `/healthz` |
| SvelteKit + `@sveltejs/adapter-node@5.5.7` | `node build` | `/healthz` |
| Nuxt (nitro `node-server`) | `node .output/server/index.mjs` | `/healthz` |

Рабочий конфиг (из `spike-astro/e2e/playwright.config.ts`, сверено [ист: файл спайка]):

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:3201' },
  webServer: {
    command: 'node ./dist/server/entry.mjs',
    url: 'http://127.0.0.1:3201/healthz',
    reuseExistingServer: true,
    timeout: 60_000,
    env: { HOST: '127.0.0.1', PORT: '3201', SITE_URL: 'http://localhost:3201' },
  },
})
```

Важно: `webServer.url` должен указывать на **`/healthz`**, а не на `/` — иначе
Playwright считает сервер живым по любому ответу, включая 404 от ещё не
прогретого статик-хендлера. Порт e2e — не 5173 и не порт dev.

### 7.2. size-limit

`size-limit` и `@size-limit/file` — **14.0.0** (2026-09-15), engines
`^22.19 || ^24.5 || >=26` [ист npm]. Спайки стоят на 13.1.1. Изменения
12/13/14 — в основном дропы старых Node и внутренние зависимости; формат
конфига и поведение `@size-limit/file` не менялись [ист:
<https://github.com/ai/size-limit/releases>].

[эксп] Прогон `size-limit@14` на реальном выходе `spike-astro/dist/client`
(скопированном в `tooling-lab/sizelab/`):

```
  JS островов (все)   Size limit: 100 kB   Size: 93.22 kB gzipped
  CSS (одна таблица)  Size limit: 5 kB     Size: 3.28 kB gzipped
```

[эксп] `@size-limit/file` **работает и на `.html`** — бюджет документа ставится тем же
плагином (проверено на синтетическом файле: «Package size limit has exceeded by …»).

**Как считать «JS на страницу», а не суммарно** — три варианта, по возрастанию честности:

1. **Глоб по всем клиентским чанкам** (как в спайках):
   `path: 'dist/client/_astro/*.js'`. Просто, но это **потолок**, а не бюджет
   страницы: сумма всех островов сайта. Для контент-first, где островов 1–2,
   этого достаточно и это самый дешёвый вариант.
2. **Стабильные имена чанков + отдельные бюджеты.** Имена с хешом не позволяют
   написать точный `path`. Лечится через rollup-выход фреймворка — добавить
   стабильный **префикс**, сохранив хеш:
   ```ts
   // astro.config.ts
   vite: { build: { rollupOptions: { output: {
     entryFileNames: '_astro/island-[name].[hash].js',
     chunkFileNames: '_astro/chunk-[name].[hash].js',
   } } } }
   ```
   тогда `path: 'dist/client/_astro/island-contact-*.js'` — бюджет конкретного
   острова. [гип: синтаксис Rollup-выхода стандартный, но конкретно на Astro 7
   в лаборатории не прогонялся].
3. **Playwright-бюджет** — единственный полностью честный: в e2e-тесте
   суммировать размеры ответов с `resourceType() === 'script'` для каждого
   маршрута и сравнивать с порогом. Это и так требуется брифом-v2 (метрика
   «JS, реально загружаемый главной / постом / контактами»). **Рекомендация:
   держать оба** — `size-limit` как быстрый гейт артефактов, e2e-бюджет как
   гейт страниц.

Бюджет HTML-документа:

```js
{ name: 'HTML главной',    path: 'dist/client/index.html',      limit: '20 KB', gzip: true },
{ name: 'HTML поста',      path: 'dist/client/blog/*/index.html', limit: '25 KB', gzip: true },
```

(при `build.format: 'directory'` страницы лежат как `<route>/index.html`.)

### 7.3. typecheck по фреймворкам

| фреймворк | команда | пакет | версия | ограничение |
|---|---|---|---|---|
| Astro | `astro check` | `@astrojs/check` | 0.9.10 (2026-07-27) | peer `typescript ^5 \|\| ^6` |
| SvelteKit | `svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --threshold error` | `svelte-check` | 4.7.6 | peer `typescript ^5 \|\| ^6` |
| Nuxt | `nuxt typecheck` | `vue-tsc` | 3.3.11 | peer `typescript >=5` |

[эксп] `astro check` на `astro-fsd` завершился `EXIT=0`, «Result (13 files): 0 errors,
0 warnings, 5 hints». Полезная находка: в Astro 7 ре-экспорт `z` из `astro:content`
**помечен deprecated** — `ts(6385): 'z' is deprecated` — схемы контента надо писать
через прямой `import { z } from 'zod'` [эксп].

**TS 6 vs TS 7.** Последняя версия TypeScript — **7.0.2** (2026-07-08) [ист npm],
но `typescript-eslint@8.70` объявляет peer `typescript >=4.8.4 <6.1.0` [ист npm].
→ **шаблон остаётся на TypeScript 6.0.x**, как SPA. Переход на 7 блокируется
typed-lint'ом, а не фреймворками.

**Strict-флаги в компонентах.** `verbatimModuleSyntax` + `noUncheckedIndexedAccess`
+ `exactOptionalPropertyTypes` работают в `.astro` (`astro/tsconfigs/strict`
наследуется, лабораторный `astro-fsd/tsconfig.json` их не отключает и проверка
зелёная [эксп]). Для `.vue`/`.svelte` — то же, проверка идёт `vue-tsc`/`svelte-check`
по тому же tsconfig. Отдельная ловушка `verbatimModuleSyntax`: в SFC/`.astro`
обязательно писать `import type { … }` для типов — иначе рантайм-импорт
компонента-типа попадёт в бандл. [гип: в лаборатории специальный кейс не ставился.]

### 7.4. lefthook и commitlint

`lefthook` — **2.1.14** (2026-09-14) [ист npm]; в SPA-шаблоне `^1.10`. Мажор 1→2;
формат `lefthook.yml` в шаблоне простой (`pre-commit`/`commit-msg`/`pre-push`),
[гип] миграция должна быть дешёвой, но её надо проверить при реализации.

`@commitlint/cli` — **21.2.2** (2026-08-13), node `>=22.12` [ист npm];
в SPA-шаблоне `^19`. Два мажора; `.commitlintrc.cjs` с `type-enum` и
`subject-max-length` — стабильный API, [гип] переносится как есть.

Что меняется в `lefthook.yml` для контент-first: глобы должны включать форматы
фреймворка, а ESLint-шаг — расширяться на компонентные файлы (листинг в §9.6).

---

## 8. Что из SPA-стека теряет смысл, что остаётся, чем заменяется

| элемент SPA-шаблона | судьба в контент-first | замена / комментарий |
|---|---|---|
| **React 19 + React Compiler** (`compilationMode: 'infer'`, `babel-plugin-react-compiler`, compiler-правила `eslint-plugin-react-hooks@7`) | смысл только если острова — React | В Astro-ветке возможны React-острова (`@astrojs/react@6.0.5`) — тогда compiler и его eslint-правила включаются **точечно, на `src/**/*.tsx`**. В SvelteKit/Nuxt — выбывает целиком |
| **TanStack Router** (file-based, `routeTree.gen.ts`, `pnpm gen`) | выбывает | Роутинг даёт фреймворк. Исчезает `pnpm gen`, исчезает Steiger-исключение на `routeTree.gen.ts` |
| **TanStack Query** | выбывает | Данные грузятся на сервере (content layer / loader / `useAsyncData`). Клиентский кеш запросов контентному сайту не нужен |
| **TanStack Form** | выбывает в базовом виде | Форма `/contact` должна работать **без JS** (progressive enhancement): Astro Actions / SvelteKit form actions / Nuxt server route. JS-остров — только прогрессивное улучшение. Валидация — та же Zod-схема на сервере и (опционально) в острове |
| **Zustand** (persist, `app.theme.v1`) | почти выбывает | Глобального клиентского состояния нет. Переключатель темы — маленький инлайновый скрипт + `data-scheme` на `<html>` + `localStorage`; store не нужен. Если острова сложные — их локальное состояние даёт сам фреймворк (`$state` / `ref` / `useState`) |
| **Zod 4** | **остаётся и усиливается** | Из «контракта API» превращается в **схему контента** (`content.config.ts` у Astro, схемы `@nuxt/content`, ручная у mdsvex). `zod@4.6.5` [ист npm] |
| **Lingui 5 runtime-only** | выбывает | Astro — встроенный i18n-роутинг (`i18n.locales`, `prefixDefaultLocale`) + свои словари; Nuxt — `@nuxtjs/i18n@10.6.0`; SvelteKit — `@inlang/paraglide-js@2.25.3` (компилируемые сообщения, ноль рантайма) [ист npm]. Для контентного сайта ключевое — **локализованные маршруты и hreflang**, а не рантайм-каталог |
| **MSW 2** (`msw/browser` SW, `@mswjs/data`, `@faker-js/faker`, сценарии `empty/populated/…`, dev-панель) | **выбывает как режим шаблона** | Контент лежит в git → «пусто/наполнено» это просто другой набор `.md`. Сценарии переезжают в фикстуры контента. MSW остаётся нужен, **только** если у сайта есть внешний API (форма → CRM, поиск → бэкенд) — тогда `msw/node` в vitest, без Service Worker и без dev-панели. Соответственно артефакт `shared-api.md` FSD-карты (сценарии мок-режима) для контентной поверхности меняет смысл — см. §10.5 |
| **Sentry + web-vitals** | остаётся | С поправкой: на контентном сайте JS минимален, поэтому Sentry должен подключаться **только** при непустом DSN и желательно в серверной части (Node-процесс), а web-vitals — опционально, чтобы не портить «ноль JS» |
| **runtime config `window.__APP_CONFIG__` + `/config.js`** | меняется | В SSR origin и прочее берутся из `process.env` в серверном рантайме. Клиентский `config.js` нужен только если острова ходят в API |
| **Tailwind v4 + собственный токен-слой** | остаётся как есть | `tailwindcss@4.3.3` + `@tailwindcss/vite@4.3.3` работают во всех трёх фреймворках (подтверждено конфигами спайков) |
| **Biome / ESLint / Steiger / Vitest / Playwright / size-limit / lefthook / commitlint / TS strict** | остаётся | С изменениями из §3–§7 |

---

## 9. Готовые черновики конфигов

Все листинги проверены в лаборатории (кроме явно помеченных [гип]).
Пути даны для раскладки «`src/pages` = слой маршрутов» (см. §10).

### 9.1. `steiger.config.ts` — общий для всех трёх фреймворков

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
      'fsd/no-segmentless-slices': 'error',
      'fsd/no-reserved-folder-names': 'error',
      'fsd/ambiguous-slice-names': 'error',
      'fsd/inconsistent-naming': 'error',
      'fsd/typo-in-layer-name': 'error',
      'fsd/excessive-slicing': 'warn',
      // Референсы из вложенных каталогов маршрутов Steiger не видит,
      // поэтому widgets ложно числятся «без референсов». Границы держит ESLint.
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // Файлы, жёстко навязанные фреймворком: это не слои FSD, а точки входа.
    // Astro:
    ignores: ['src/content.config.ts', 'src/middleware.ts', 'src/actions/**', 'src/env.d.ts'],
    // SvelteKit: ignores: ['src/app/app.html', 'src/app/error.html', 'src/app/app.d.ts']
    // Nuxt:      ignores: ['src/app.vue', 'src/error.vue']
  },
  {
    // src/pages — файловый роутинг: index.* это маршрут '/', подпапки blog/ en/ [slug]/ —
    // сегменты URL, а не слайсы с сегментами FSD.
    files: ['src/pages/**'],
    rules: {
      'fsd/no-layer-public-api': 'off',
      'fsd/no-segmentless-slices': 'off',
      'fsd/no-segments-on-sliced-layers': 'off',
      'fsd/public-api': 'off',
    },
  },
  {
    // 'layouts' / 'middleware' / 'styles' — устоявшиеся имена сегментов app-слоя.
    files: ['src/app/**'],
    rules: { 'fsd/segments-by-purpose': 'off', 'fsd/public-api': 'off' },
  },
])
```

[эксп] С этим конфигом на дереве `fw-layouts/astro-b` остаются только настоящие
нарушения (forbidden-import вверх + два sidestep'а), а весь структурный шум
файлового роутинга исчезает.

### 9.2. `eslint.config.js` — **Astro**

Зависимости: `eslint@^10.10`, `@eslint/js@^10`, `typescript-eslint@^8.70`,
`eslint-plugin-astro@^3.2`, `astro-eslint-parser@^3.1`, `eslint-plugin-jsx-a11y@^6.10.2`,
`eslint-plugin-boundaries@^7.2`, `eslint-import-resolver-typescript@^4.4`, `globals@^17`.

```js
import js from '@eslint/js'
import * as astroParser from 'astro-eslint-parser'
import astro from 'eslint-plugin-astro'
import boundaries from 'eslint-plugin-boundaries'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const EXT = ['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.astro']

const fsdSettings = {
  'boundaries/dependency-nodes': ['import', 'dynamic-import', 'export'],
  'boundaries/elements': [
    { type: 'app', pattern: 'src/app/**', partialMatch: false },
    { type: 'pages', pattern: 'src/pages/**', partialMatch: false },
    { type: 'widgets', pattern: 'src/widgets/*', capture: ['slice'] },
    { type: 'features', pattern: 'src/features/*', capture: ['slice'] },
    { type: 'entities', pattern: 'src/entities/*', capture: ['slice'] },
    { type: 'shared', pattern: 'src/shared/**', partialMatch: false },
  ],
  'boundaries/include': ['src/**'],
  'import/resolver': {
    typescript: { project: './tsconfig.json', extensions: EXT },
    node: { extensions: EXT },
  },
}

const same = (type) => ({ to: { element: { type, captured: { slice: '{{from.slice}}' } } } })
const to = (...types) => types.map((type) => ({ to: { element: { type } } }))

const fsdRules = {
  'boundaries/dependencies': ['error', {
    default: 'disallow',
    policies: [
      { from: [{ element: { type: 'app' } }],      allow: to('pages', 'widgets', 'features', 'entities', 'shared') },
      { from: [{ element: { type: 'pages' } }],    allow: to('widgets', 'features', 'entities', 'shared') },
      { from: [{ element: { type: 'widgets' } }],  allow: [same('widgets'), ...to('features', 'entities', 'shared')] },
      { from: [{ element: { type: 'features' } }], allow: [same('features'), ...to('entities', 'shared')] },
      { from: [{ element: { type: 'entities' } }], allow: [same('entities'), ...to('shared')] },
      { from: [{ element: { type: 'shared' } }],   allow: to('shared') },
    ],
  }],
  // Ловит deep-import по форме спецификатора — расширение цели неважно,
  // поэтому закрывает главную слепую зону Steiger.
  'no-restricted-imports': ['error', { patterns: [
    { group: ['@/entities/*/*', '@/features/*/*', '@/widgets/*/*', '@/pages/*/*'],
      message: 'FSD: импорт мимо public API слайса' },
    { group: ['@/shared/*/*', '!@/shared/ui/*', '!@/shared/lib/*', '@/shared/ui/*/*', '@/shared/lib/*/*'],
      message: 'FSD: импорт мимо public API сегмента shared' },
  ]}],
}

export default [
  { ignores: ['dist/**', '.astro/**', 'node_modules/**', 'playwright-report/**', '*.config.*'] },
  js.configs.recommended,
  ...astro.configs['flat/recommended'],
  ...astro.configs['flat/jsx-a11y-recommended'],
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    // Логика слайсов: здесь можно позволить typed-lint.
    files: ['src/**/*.{ts,mts,cts}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { boundaries },
    settings: fsdSettings,
    rules: fsdRules,
  },
  {
    files: ['src/**/*.astro'],
    languageOptions: {
      parser: astroParser,
      parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.astro'] },
    },
    plugins: { boundaries },
    settings: fsdSettings,
    rules: fsdRules,
  },
  {
    // Клиентские <script> Astro процессор отдаёт как виртуальные файлы.
    // Без этого блока импорты из них не проверяются НИЧЕМ.
    files: ['src/**/*.astro/*.ts', 'src/**/*.astro/*.js'],
    languageOptions: { parser: tseslint.parser, sourceType: 'module' },
    plugins: { boundaries },
    settings: fsdSettings,
    rules: fsdRules,
  },
]
```

[эксп] На дереве `fw-layouts/astro-b` конфиг ловит: sidestep во всех четырёх файлах
маршрутов (включая `blog/index.astro` и `blog/[slug].astro`, которые Steiger
пропускает) + `boundaries/dependencies` на `entities → widgets`.

### 9.3. `eslint.config.js` — **SvelteKit**

Зависимости: `eslint@^10.10` (или `^9.39` — плагины Svelte поддерживают обе),
`eslint-plugin-svelte@^3.23`, `svelte-eslint-parser@^1.8`, `typescript-eslint@^8.70`,
`eslint-plugin-boundaries@^7.2`, `eslint-import-resolver-typescript@^4.4`.

Отличия от Astro-варианта: `EXT` включает `.svelte`; добавлены `**/*.svelte.ts`
(runes-модули Svelte 5); a11y — через `svelte/valid-compile`.

```js
import js from '@eslint/js'
import boundaries from 'eslint-plugin-boundaries'
import svelte from 'eslint-plugin-svelte'
import svelteParser from 'svelte-eslint-parser'
import globals from 'globals'
import tseslint from 'typescript-eslint'
// fsdSettings / fsdRules — как в §9.2, с EXT = [..., '.svelte']

export default [
  { ignores: ['build/**', '.svelte-kit/**', 'node_modules/**', '*.config.*'] },
  js.configs.recommended,
  ...svelte.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    files: ['src/**/*.{ts,mts,cts}'],
    languageOptions: { parser: tseslint.parser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    plugins: { boundaries }, settings: fsdSettings, rules: fsdRules,
  },
  {
    files: ['src/**/*.svelte', 'src/**/*.svelte.{ts,js}'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.svelte'] },
    },
    plugins: { boundaries },
    settings: fsdSettings,
    rules: {
      ...fsdRules,
      // У eslint-plugin-svelte нет собственных a11y-правил: их даёт компилятор.
      'svelte/valid-compile': 'error',
    },
  },
]
```

Если маршруты остаются в `src/routes` (см. §10.3), в `fsdSettings` меняется одна
строка: `{ type: 'pages', pattern: 'src/routes/**', partialMatch: false }` [эксп].

### 9.4. `eslint.config.js` — **Nuxt / Vue**

Зависимости: `eslint@^10.10`, `eslint-plugin-vue@^10.11`, `vue-eslint-parser@^10.4`,
`eslint-plugin-vuejs-accessibility@^2.6`, `typescript-eslint@^8.70`,
`eslint-plugin-boundaries@^7.2`. Опционально `@nuxt/eslint@^1.17` (генерирует
конфиг с учётом автоимпортов; в шаблоне автоимпорты выключены, поэтому не обязателен).

```js
import js from '@eslint/js'
import boundaries from 'eslint-plugin-boundaries'
import vue from 'eslint-plugin-vue'
import vueA11y from 'eslint-plugin-vuejs-accessibility'
import vueParser from 'vue-eslint-parser'
import globals from 'globals'
import tseslint from 'typescript-eslint'
// fsdSettings / fsdRules — как в §9.2, с EXT = [..., '.vue']

export default [
  { ignores: ['.nuxt/**', '.output/**', 'node_modules/**', '*.config.*'] },
  js.configs.recommended,
  ...vue.configs['flat/recommended'],
  ...vueA11y.configs['flat/recommended'],
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    files: ['src/**/*.{ts,mts,cts}'],
    languageOptions: { parser: tseslint.parser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    plugins: { boundaries }, settings: fsdSettings, rules: fsdRules,
  },
  {
    files: ['src/**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.vue'] },
    },
    plugins: { boundaries }, settings: fsdSettings, rules: fsdRules,
  },
  {
    // Файловый роутинг Nuxt даёт односложные имена компонентов — это не смелл.
    files: ['src/pages/**/*.vue', 'src/app.vue', 'src/error.vue'],
    rules: { 'vue/multi-word-component-names': 'off' },
  },
  {
    // Biome форматирует разметку; стилевые правила eslint-plugin-vue должны молчать,
    // иначе pre-commit будет гонять файл между двумя форматтерами.
    rules: {
      'vue/html-indent': 'off',
      'vue/html-self-closing': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/attributes-order': 'off',
      'vue/first-attribute-linebreak': 'off',
    },
  },
]
```

[эксп] Без последнего блока `vue.configs['flat/recommended']` выдал 17 стилевых
предупреждений на 12-строчном компоненте — прямой конфликт с Biome-форматтером.

### 9.5. `biome.json` — общий, с per-extension override

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.14/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": {
    "ignoreUnknown": true,
    "includes": [
      "**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts", "**/*.js", "**/*.mjs",
      "**/*.astro", "**/*.svelte", "**/*.vue",
      "**/*.json", "**/*.jsonc", "**/*.css",
      "!**/dist", "!**/build", "!**/.output", "!**/.nuxt", "!**/.svelte-kit",
      "!**/.astro", "!**/coverage", "!**/node_modules", "!**/.vitest"
    ]
  },
  "formatter": {
    "enabled": true, "indentStyle": "space", "indentWidth": 2,
    "lineWidth": 100, "lineEnding": "lf"
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single", "jsxQuoteStyle": "double", "semicolons": "asNeeded",
      "trailingCommas": "all", "arrowParentheses": "always",
      "bracketSpacing": true, "bracketSameLine": false
    }
  },
  "css": { "parser": { "tailwindDirectives": true } },
  "html": {
    "experimentalFullSupportEnabled": true,
    "formatter": {
      "enabled": true,
      "indentScriptAndStyle": true,
      "selfCloseVoidElements": "always"
    }
  },
  "linter": {
    "enabled": true,
    "rules": {
      "preset": "recommended",
      "correctness": { "noUnusedVariables": "error", "noUnusedImports": "error" },
      "style": { "useImportType": "error", "useExportType": "error", "useConst": "error" },
      "suspicious": {
        "noExplicitAny": "warn",
        "noConsole": { "level": "warn", "options": { "allow": ["warn", "error", "info"] } }
      }
    }
  },
  "overrides": [
    {
      "includes": ["**/*.vue"],
      "html": { "formatter": { "indentScriptAndStyle": false } }
    }
  ]
}
```

Комментарии к решениям (все проверены [эксп]):
`experimentalFullSupportEnabled: true` обязателен — без него `noUnusedVariables`/
`noUnusedImports` дают ложные срабатывания и их пришлось бы выключить целиком;
`selfCloseVoidElements: "always"` снимает конфликт с `vue/html-self-closing` и
`prettier-plugin-svelte`; override для `.vue` — потому что в Vue-экосистеме
`<script setup>` не индентируется, а в Svelte — индентируется.

### 9.6. `lefthook.yml`

```yaml
pre-commit:
  parallel: true
  commands:
    biome:
      glob: "*.{ts,tsx,mts,cts,js,mjs,astro,svelte,vue,json,jsonc,css}"
      run: pnpm biome check --write --no-errors-on-unmatched {staged_files}
      stage_fixed: true
    eslint:
      glob: "src/**/*.{ts,mts,cts,astro,svelte,vue}"
      run: pnpm eslint --fix --no-error-on-unmatched-pattern --cache {staged_files}
      stage_fixed: true

commit-msg:
  commands:
    commitlint:
      run: pnpm commitlint --edit {1}

pre-push:
  parallel: false
  commands:
    check:
      run: pnpm check
```

`--cache` в pre-commit добавлен осознанно: холодный старт ESLint с парсерами
фреймворков — самая дорогая операция гейта (§11.3).

### 9.7. `.size-limit.cjs` — Astro (аналогично для двух других)

```js
// Бюджеты клиентских ассетов. Островной JS грузится только там, где есть остров;
// «ноль JS» на контентных страницах проверяется отдельно в e2e.
module.exports = [
  { name: 'JS островов (весь сайт)', path: 'dist/client/_astro/*.js',  limit: '100 KB', gzip: true },
  { name: 'CSS (одна таблица)',      path: 'dist/client/_astro/*.css', limit: '5 KB',   gzip: true },
  { name: 'HTML главной',            path: 'dist/client/index.html',   limit: '20 KB',  gzip: true },
  { name: 'HTML поста',              path: 'dist/client/blog/*/index.html', limit: '25 KB', gzip: true },
]
```

Пути выходов по фреймворкам: Astro — `dist/client/_astro`;
SvelteKit (`adapter-node`) — `build/client/_app/immutable`;
Nuxt (nitro `node-server`) — `.output/public/_nuxt`;
Next — `.next/static` (для справки; Next в финалистах этого потока не разбирался).

### 9.8. `vitest.config.ts`

**Astro** (два проекта — обязательно):

```ts
import { getViteConfig } from 'astro/config'

export default getViteConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,mts}'],
      exclude: ['src/**/*.test.ts', 'src/app/**'],
      thresholds: { lines: 60, functions: 60, branches: 60, statements: 60 },
    },
    projects: [
      { extends: true, test: { name: 'astro', environment: 'node',
          include: ['src/**/*.astro.test.ts', 'src/**/*.server.test.ts'] } },
      { extends: true, test: { name: 'dom', environment: 'happy-dom',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.astro.test.ts', 'src/**/*.server.test.ts'] } },
    ],
  },
})
```

**SvelteKit**:

```ts
import { sveltekit } from '@sveltejs/kit/vite'
import { svelteTesting } from '@testing-library/svelte/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // svelteTesting() обязателен: иначе mount() резолвит серверную сборку svelte
  // и падает с lifecycle_function_unavailable.
  plugins: [sveltekit(), svelteTesting()],
  test: { globals: true, environment: 'happy-dom', include: ['src/**/*.test.ts'] },
})
```

**Nuxt** — либо «чистый» Vue-конфиг (`@vitejs/plugin-vue` + `happy-dom`), либо
`defineVitestConfig` из `@nuxt/test-utils/config` с `environment: 'nuxt'` для
интеграционных тестов. [гип: в лаборатории проверен только «чистый» вариант.]

---

## 10. FSD для контент-first сайта

### 10.1. Маппинг слоёв

| слой FSD | что лежит на контентном сайте | пример |
|---|---|---|
| `app` | документ-шелл, layout'ы, middleware, глобальные стили, конфиг рантайма, хуки фреймворка | `app/layouts/base.astro`, `app/middleware/index.ts`, `app/styles/index.css`, `app/hooks.server.ts` |
| `pages` | **маршруты фреймворка** — 1 файл = 1 URL (или группа URL для `[slug]`) | `pages/index.astro`, `pages/blog/[...page].astro`, `pages/sitemap.xml.ts`, `pages/robots.txt.ts` |
| `widgets` | секции и зоны каркаса, переиспользуемые на ≥2 маршрутах | `widgets/site-header`, `widgets/site-footer`, `widgets/post-list`, `widgets/hero` |
| `features` | интерактивные сценарии = острова и серверные обработчики | `features/contact-form` (форма + action), `features/search`, `features/theme-toggle` |
| `entities` | **типы контента**: `content/*.md` + Zod-схема + презентер | `entities/post/{content/,model/schema.ts,ui/post-card.astro,index.ts}` |
| `shared` | `seo/`, `content/` (загрузчики), `ui/`, `lib/`, `config/`, `i18n/` | `shared/seo/index.ts` (canonical/hreflang/JSON-LD), `shared/i18n/locales/` |

Это ровно тот маппинг, который независимо сложился в трёх спайках раунда 2
(`spike-astro`, `spike-sveltekit`, `spike-nuxt` — деревья `src/` совпадают
по слоям) [ист: чтение спайков].

**Не противоречит ли канону FSD.** Канон feature-sliced.design формулирует
слой `pages` как «полноценные страницы / крупные части страницы при вложенном
роутинге» и прямо допускает, что содержимое слоя определяется роутером; слои
`widgets` и `features` необязательны. Контент-first раскладка конфликтов
с каноном не создаёт — единственная натяжка в том, что каталог маршрутов
фреймворка вводит **вложенные каталоги без сегментов**, чего FSD для
нарезаемого слоя не предполагает. Именно это и ловит `no-segmentless-slices`
(§3.5) и именно это отключается конфигом. [гип: отдельной страницы «FSD +
Astro/SvelteKit/Nuxt» в официальной документации найти не удалось; вывод —
из общей формулировки слоёв.]

### 10.2. Пример дерева (Astro-вариант, `srcDir` по умолчанию)

```
src/
├─ app/
│  ├─ layouts/base.astro            # документ, <head>, слоты
│  ├─ styles/index.css              # @theme + семантические токены + data-scheme
│  └─ config/runtime.ts             # SITE_URL, ROBOTS_POLICY из process.env
├─ pages/                           # = каталог маршрутов Astro
│  ├─ index.astro
│  ├─ about.astro
│  ├─ contact.astro
│  ├─ now.astro                     # export const prerender = false
│  ├─ 404.astro
│  ├─ blog/
│  │  ├─ [...page].astro
│  │  └─ [slug].astro
│  ├─ en/
│  │  ├─ index.astro
│  │  └─ blog/[...page].astro
│  ├─ robots.txt.ts
│  ├─ sitemap.xml.ts
│  └─ healthz.ts
├─ widgets/
│  ├─ site-header/{ui/site-header.astro,index.ts}
│  ├─ site-footer/{ui/site-footer.astro,index.ts}
│  ├─ post-list/{ui/post-list.astro,index.ts}
│  └─ hero/{ui/hero.astro,index.ts}
├─ features/
│  └─ contact-form/
│     ├─ ui/contact-form.astro      # <form method="post"> — работает без JS
│     ├─ ui/contact-form-island.tsx # опциональное улучшение
│     ├─ model/schema.ts            # Zod, одна схема на сервер и клиент
│     └─ index.ts
├─ entities/
│  └─ post/
│     ├─ content/ru/*.md            # сам контент — часть сущности
│     ├─ content/en/*.md
│     ├─ model/schema.ts            # Zod-схема frontmatter
│     ├─ api/queries.ts             # getPosts / getPostBySlug поверх content layer
│     ├─ ui/post-card.astro
│     └─ index.ts
├─ shared/
│  ├─ seo/index.ts                  # canonical, hreflang, OG, JSON-LD
│  ├─ i18n/{index.ts,locales/{ru,en}.ts}
│  ├─ ui/<name>/{<name>.astro,index.ts}
│  ├─ lib/{cn.ts,invariant.ts,index.ts}
│  └─ config/index.ts
├─ content.config.ts                # ← навязано Astro, в ignores Steiger
├─ middleware.ts                    # ← навязано Astro
├─ actions/index.ts                 # ← навязано Astro
└─ env.d.ts                         # ← навязано Astro
```

Проверка на этом дереве: `steiger src` с конфигом §9.1 — чисто;
`eslint src` с конфигом §9.2 — чисто [эксп, на эквивалентном `fw-layouts/astro-b`].

### 10.3. Навязанные каталоги и исключения — по фреймворкам

#### Astro 7.3.2

Обязаны лежать **внутри `srcDir`**: `pages/`, `content.config.ts`, `middleware.ts`,
`actions/`, `env.d.ts`. **Перенести только `pages` нельзя — «There is no option
to move only pages; the entire `src/` structure relocates together»**
[ист: <https://docs.astro.build/en/reference/configuration-reference/>, 2026-09-16].

Два варианта раскладки:

| | **A. `srcDir: './src'` (рекомендуется)** | **B. `srcDir: './src/app'`** |
|---|---|---|
| слой `pages` | настоящий слой FSD (`src/pages`) | **исчезает**: маршруты становятся сегментом `src/app/pages` |
| навязанные файлы | лежат в корне `src/` рядом со слоями; Steiger их игнорирует, но визуально «мусор» | все внутри слоя `app` — чисто |
| `no-layer-public-api` на `pages/index.astro` | срабатывает, гасится конфигом | не срабатывает (`app` в `exceptionLayers` плагина) |
| `forbidden-imports` для маршрутов | работает на файлах в корне `src/pages` | **не работает вообще**: `app` — несрезаемый слой, «pages» в нём просто сегмент |
| FSD-карта strategy (`pages.md`) | разворачивается 1:1 в `src/pages/<slug>` | разворачивается в сегмент, kind ↔ путь ломается |
| проверено | `fw-layouts/astro-b` [эксп] | `tooling-lab/astro-fsd` [эксп] — `steiger src` даёт лишь `segments-by-purpose` на `app/middleware` |

**Вывод: вариант A.** Вариант B красивее визуально, но платит слоем `pages` —
а именно он связывает код с `pages.md` FSD-карты и даёт единственные работающие
проверки маршрутов в Steiger. Исключения Steiger для A — в §9.1.

#### SvelteKit 2.70.3

Навязано: `src/app.html` (шаблон), `src/error.html`, `src/app.d.ts`,
`src/hooks.{server,client}.ts`, `src/routes/**`, `src/lib` (`$lib`), `static/`.
Всё это переносится через `kit.files.*` — но **вся секция `kit.files`
задокументирована как deprecated** («All sub-options are deprecated in favor
of monorepos») [ист: <https://svelte.dev/docs/kit/configuration>, 2026-09-16].

Работающая раскладка (взята из `spike-sveltekit/svelte.config.js`, собирается [ист]):

```js
kit: {
  files: {
    routes: 'src/pages',
    lib: 'src/shared',
    appTemplate: 'src/app/app.html',
    errorTemplate: 'src/app/error.html',
    hooks: { server: 'src/app/hooks.server', client: 'src/app/hooks.client', universal: 'src/app/hooks' },
    params: 'src/app/params',
    assets: 'static',
  },
  alias: { '@': 'src', '@/*': 'src/*' },
}
```

⚠️ **Риск**: опция помечена deprecated; если её удалят в SvelteKit 3, шаблон
вернётся к `src/routes`. Запасной вариант проверен [эксп]: маршруты остаются
в `src/routes`, а в ESLint `boundaries` тип `pages` вешается на
`pattern: 'src/routes/**'` — все проверки границ сохраняются, теряется только
то немногое, что Steiger давал на корне слоя.

Плюс SvelteKit: файлы маршрутов называются `+page.svelte`/`+server.ts`, поэтому
`no-layer-public-api` **не срабатывает вообще** (нет `index.*`) [эксп].
Колокация секций рядом с маршрутом делается не-`+` файлами — и это как раз то,
что Steiger не индексирует; ESLint покрывает.

#### Nuxt 4.5.2

**Дефолт Nuxt 4: `srcDir: "app"`**, `dir.pages: "app/pages"`, `app.vue`/`error.vue`
в `app/` [ист: <https://nuxt.com/docs/4.x/api/nuxt-config>, 2026-09-16]. Имя `app`
прямо конфликтует со слоем `app` FSD — но `dir.pages` **можно менять**.

Работающая раскладка (из `spike-nuxt/nuxt.config.ts`, собирается [ист]):

```ts
srcDir: 'src',
dir: {
  pages: 'pages',            // → src/pages
  layouts: 'app/layouts',    // → src/app/layouts
  plugins: 'app/plugins',
  middleware: 'app/middleware',
  assets: 'app/assets',
},
imports: { autoImport: false },   // явные импорты — иначе FSD-границы не видны линтерам
components: { dirs: [] },         // то же для авто-регистрации компонентов
alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
```

`src/app.vue` и `src/error.vue` остаются в корне `srcDir` (Steiger их игнорирует
[эксп]); `server/` живёт **вне** `src` (Nitro-роуты — не часть FSD-графа).

🔴 **Критично для Nuxt**: `imports.autoImport: false` и `components.dirs: []`
обязательны. С автоимпортами компонент из `entities` появляется в `pages` **без
строки import** — ни ESLint, ни Steiger такого нарушения не увидят в принципе.
Это не «стилевое» решение, а условие работоспособности всего архитектурного гейта.
[гип: в лаборатории отдельно не воспроизводилось, вывод следует из того, что оба
инструмента анализируют только явные импорты.]

#### Next (для справки)

`src/app` (App Router) занимает имя слоя `app`, поэтому в `spike-next` слой
`pages` FSD вынесен в `src/views/`, а тонкие `page.tsx` живут в `src/app/[lang]/`
[ист: чтение `spike-next`]. Для FSD это худший из четырёх вариантов: слой `app`
приходится переименовывать или уступать фреймворку.

### 10.4. Колокация секций vs `insignificant-slice`

FSD-инвариант «pages-first» (widget только при ≥2 референсах) на контентном сайте
работает и должен остаться **в проектировании** (FSD-карта strategy его проверяет
через зеркало `widgets.pages`). Но **автоматически его проверить нечем**:
`insignificant-slice` считает референсы по графу Steiger, а референсы из
вложенных маршрутов невидимы [эксп, §3.4]. Поэтому:

- `fsd/insignificant-slice: 'off'` в `steiger.config.ts`;
- инвариант остаётся на `/fsd-audit` в `<org>/strategy` (он считает по карте,
  а не по коду) — это даже честнее, потому что смотрит на замысел;
- колокация «секция только для одной страницы» делается средствами фреймворка:
  Astro — `src/pages/_components/` (префикс `_` исключает из роутинга),
  SvelteKit — любой не-`+` файл рядом с маршрутом, Nuxt — только вне `pages/`
  (там **любой** `.vue` становится маршрутом). Для Nuxt вывод: колокации нет,
  секция одной страницы живёт в `src/widgets/<slug>` или прямо в файле маршрута.

### 10.5. FSD-карта strategy и контентные сущности

Канон (`business-strategy-template/docs/projects/_template/fsd/README.md`,
прочитан [ист]) уже содержит нужный крючок:

> `entities.source` — «агрегат/сущность домена (`<svc>/<ctx>/<slug>`) или,
> **если бэка нет**, `data-items` своей поверхности».

→ **Контентная сущность (`post`, `doc`, `case`, `service`) описывается в
`entities.md` с `source = data-items`**, поля = frontmatter. Ничего в каноне
менять не нужно.

Что в каноне **не ложится** на контентный сайт и требует решения владельца:

1. **`pages.md → guard`** (`public | authenticated | <роль>`). Для контентного
   сайта почти всё `public`; колонка вырождается. [предложение] Оставить как есть
   — вырожденное значение не мешает, а кабинет за логином всё ещё возможен.
2. **`pages.md` не содержит SEO-полей** (`title`/`description`/`indexable`/
   `rendering`) — а для индексируемого сайта это первоклассные атрибуты маршрута.
   [предложение] Либо расширить `pages.md` тремя колонками (`indexable`,
   `rendering: prerender|server|swr`, `changefreq`), либо завести локальный
   kind `docs/stack/seo.md` во фронт-форке. Решение — за владельцем; это же
   отмечено в `05-template-design.md`/`13-template-v2.md`.
3. **`shared-api.md` = «сценарии данных для мок-режима»**. При контенте в git
   мок-режима нет. [предложение] Для контентной поверхности файл переосмысляется
   как «источники контента и их покрытие»: коллекции, локали, обязательные поля,
   и — если есть внешние API (форма → CRM) — их контракты. Сценарии `empty`/
   `populated` остаются осмысленными как наборы фикстур контента.
4. **`app.md` (init-последовательность + providers)**. В SSR «до первого рендера»
   происходит на сервере: чтение env, инициализация кеша, middleware. Providers
   в Astro/SvelteKit почти отсутствуют. [предложение] Читать `app.md` как
   «серверный bootstrap + middleware-цепочка».

### 10.6. Как `/scaffold` порождает слайсы в новых форматах

Текущий скилл (`.claude/skills/scaffold/SKILL.md`, прочитан [ист]) раскладывает
`entity/feature/widget/page` в `.tsx` и после page-файла зовёт `pnpm gen`
(TanStack). Для контент-first шаблона нужны изменения:

1. **Расширение файлов — параметр шаблона**, а не константа: `.astro` / `.svelte`
   / `.vue`. Источник — `docs/stack/service.md` (или новый `docs/stack/rendering.md`).
2. **`pnpm gen` исчезает** — роут-дерево генерирует сам фреймворк.
3. **Шаблон `page`** перестаёт быть одним файлом: для Astro — `src/pages/<slug>.astro`;
   для SvelteKit — `src/pages/<slug>/+page.svelte` (+ опционально `+page.server.ts`);
   для Nuxt — `src/pages/<slug>.vue`.
4. **Шаблон `entity`** получает четвёртый сегмент — `content/`: каталог `.md`
   с примером файла и frontmatter под Zod-схему из `model/schema.ts`.
5. **Mock-handler больше не дефолт.** Секция «Mock handler (если нужен)» остаётся
   только для слайсов с внешним API; для контентных entity генерируется
   `api/queries.ts` поверх content layer фреймворка.
6. **Public API — всегда `index.ts`** (не `index.astro`/`index.svelte`): §3.3.
   Скилл должен генерировать `export { default as PostCard } from './ui/post-card.astro'`.
7. **Post-flight** дополняется: `pnpm steiger src` + **`pnpm lint`** (теперь
   именно ESLint — основной сторож границ), + `pnpm typecheck` фреймворковой
   командой.

Пример генерируемого `entity` (Astro-профиль):

```
src/entities/<slug>/
├─ content/ru/<slug>-example.md     # frontmatter под схему
├─ model/schema.ts                  # Zod
├─ model/schema.test.ts
├─ api/queries.ts                   # get<Slug>s / get<Slug>BySlug
├─ ui/<slug>-card.astro
├─ ui/<slug>-card.astro.test.ts     # Container API
└─ index.ts                         # explicit re-exports
```

---

## 11. Новый состав `pnpm check`

### 11.1. Общий принцип

Состав шагов и их порядок остаются такими же, как в SPA-шаблоне
(`typecheck → lint → format:check → test → steiger → build → size`).
Меняются **команды внутри шагов**, а не структура: это сохраняет мышечную память
и агентную обвязку (`/smartdev`, `/release`, `lefthook pre-push`).

Единственное содержательное изменение — **центр тяжести архитектурной проверки
переехал из `steiger` в `lint`** (§3.8). Это надо отразить в `CLAUDE.md` шаблона,
иначе будущий агент решит, что `pnpm steiger` — достаточная гарантия FSD.

### 11.2. Скрипты по фреймворкам

**Astro**

```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "start": "node ./dist/server/entry.mjs",
    "typecheck": "astro check",
    "lint": "biome check . && eslint .",
    "lint:fix": "biome check --write . && eslint --fix .",
    "format": "biome format --write .",
    "format:check": "biome format .",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test -c e2e/playwright.config.ts",
    "steiger": "steiger src",
    "size": "size-limit",
    "knip": "knip",
    "check": "pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm steiger && pnpm build && pnpm size",
    "prepare": "lefthook install"
  }
}
```

**SvelteKit** — отличаются `dev/build/start/typecheck`:

```json
{
  "dev": "vite dev",
  "build": "vite build",
  "start": "node build",
  "typecheck": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --threshold error"
}
```

⚠️ `svelte-kit sync` **обязателен перед** `svelte-check` и перед `eslint`
с typed-lint: он генерирует `.svelte-kit/types` и `$types`-импорты, без которых
проверка падает на всех `+page.server.ts`. Если `check` запускается на чистом
клоне — `sync` должен стоять первым шагом.

**Nuxt**:

```json
{
  "dev": "nuxt dev",
  "build": "nuxt build",
  "start": "node .output/server/index.mjs",
  "typecheck": "nuxt typecheck"
}
```

⚠️ `nuxt typecheck` внутри делает `nuxt prepare` (генерация `.nuxt/`), поэтому
он должен идти **первым** шагом `check` — иначе `eslint` не найдёт
сгенерированные типы.

### 11.3. Замеры (лаборатория, 20 CPU / ~15 ГБ RAM, машина под нагрузкой)

| шаг | команда | время |
|---|---|---|
| Steiger, 13 файлов | `steiger src` | **0,99 с** |
| Steiger, 121 файл | `steiger src` (`steiger-matrix`) | **0,77 с** |
| ESLint, холодный старт | `eslint src` | **21,4 с** |
| ESLint, прогретый | `eslint src` | **1,04 с** |
| ESLint, `--cache` (второй прогон) | `eslint src --cache` | **0,74 с** |
| Biome (lint+format) | `biome check .` | **0,04 с** |
| dependency-cruiser | `depcruise src --config …` | **0,68 с** |
| Vitest 5, 3 теста (Astro Container + Zod + axe) | `vitest run` | **1,17 с** |
| Vitest 5, 2 теста (Svelte + Vue + axe) | `vitest run` | **0,81 с** |
| size-limit 14, 2 бюджета на реальном `dist` | `size-limit` | < 1 с |

Выводы по времени [эксп]:

- Steiger практически бесплатен и **не масштабируется с числом файлов** линейно
  (121 файл быстрее 13 — доминирует загрузка WASM-парсеров). Держать в гейте.
- **ESLint — единственный дорогой шаг**, и почти вся цена — холодный старт
  (загрузка парсеров фреймворков + typed-lint). Обязательно `--cache` в
  pre-commit; в `pnpm check` кэш не нужен (полный прогон).
- Biome бесплатен; отделять `format:check` от `lint` ничего не стоит.
- Реальную длительность `pnpm check` определяют `build` и `typecheck`
  фреймворка. [гип] Замеров `astro build` / `nuxt build` / `vite build`
  в этой лаборатории не делалось — они есть у спайк-потоков 08–11.

### 11.4. Что в pre-commit, что в pre-push

| хук | шаги | почему |
|---|---|---|
| `pre-commit` | `biome check --write` (staged) + `eslint --fix --cache` (staged `src/**`) | быстро, авто-фиксит, не пускает мусор в коммит |
| `commit-msg` | `commitlint --edit` | Conventional Commits |
| `pre-push` | `pnpm check` целиком | единственный полный контур |
| CI-stage (отдельно) | `pnpm test:e2e` | Playwright тянет браузеры, в локальный цикл не входит |
| вручную | `pnpm knip` | высокий шум на шаблоне с reference-слайсами |

`dependency-cruiser` в гейт **не включается** (для Astro бесполезен, для
остальных дублирует ESLint). Если владелец хочет второй независимый контур
в SvelteKit/Nuxt-ветке — отдельный скрипт `pnpm depcruise`, не в `check`.

---

## 12. Риски и открытые вопросы владельцу

### 12.1. Риски

| # | риск | вероятность | смягчение |
|---|---|---|---|
| R1 | **Steiger fail-open**: нерезолвимый импорт молча считается «нет нарушения». Агент, дописавший слайс, увидит зелёный `pnpm steiger` и решит, что границы целы | высокая, уже реализуется | ESLint — основной сторож; в `CLAUDE.md` прямо написать «Steiger — структурный линтер, границы держит `pnpm lint`»; в шаблон положить **негативный тест гейта** (заведомо нарушающий файл под `.gate-fixtures/`, который CI запускает отдельным прогоном и ждёт ненулевой код) |
| R2 | `html.experimentalFullSupportEnabled` — **экспериментальный флаг**; поведение может измениться в любом миноре Biome | средняя | фиксировать точную версию Biome (`"@biomejs/biome": "2.5.14"` без `^`), обновлять осознанно |
| R3 | `kit.files.*` в SvelteKit **deprecated** — раскладка `src/pages` может отвалиться в SvelteKit 3 | средняя | запасной вариант (`src/routes` + `boundaries` на `src/routes/**`) проверен [эксп]; заложить его в доку как план Б |
| R4 | Nuxt-автоимпорты убивают весь архитектурный гейт (импортов нет — нарушений «нет») | высокая при дефолтном конфиге | `imports.autoImport: false` + `components.dirs: []` — сделать инвариантом шаблона и правилом в `CLAUDE.md` |
| R5 | `eslint-plugin-jsx-a11y@6.10.2` не обновлялся с 2024-10-26 и не объявляет `eslint ^10` | средняя | работает [эксп]; при поломке — переезд на `eslint-plugin-jsx-a11y-x@0.2.0` (peer `^9 \|\| ^10`), который `eslint-plugin-astro@3.2.0` уже поддерживает |
| R6 | Молчаливая деградация a11y-конфига Astro: без `eslint-plugin-jsx-a11y` конфиг = 0 правил, прогон зелёный | высокая (легко потерять при prune зависимостей) | негативная фикстура в `.gate-fixtures/` (см. R1) обязана содержать `<img>` без alt |
| R7 | `steiger` + плагин не публиковались с 2026-07-14; поддержки не-`.ts`-целей нет и в планах не видно | средняя | роль Steiger уже сведена к структурным правилам — деградация терпима; при полной остановке проекта его можно снять без потери границ (останутся только проверки public API / имён) |
| R8 | `vitest-axe@0.1.0` заброшен (2022) | высокая | не использовать; свой хелпер поверх `axe-core@4.13` [эксп] |
| R9 | `vitest-browser-astro@0.2.0` несовместим с Astro 7 / Vitest 5 | — | не использовать; Container API достаточно [эксп] |
| R10 | Мажоры инструментов гейта относительно SPA-шаблона: `eslint` 9→10, `size-limit` 11→14, `lefthook` 1→2, `@commitlint/cli` 19→21, `vitest` 4→5, `eslint-plugin-boundaries` 5→7 | — | шаблон новый, ставим сразу актуальное; **обратный перенос в SPA-шаблон — отдельная задача**, здесь не решается |
| R11 | TypeScript 7.0.2 уже вышел, но `typescript-eslint@8.70` требует `<6.1.0` | средняя | остаёмся на TS 6.0.x; следить за мажором typescript-eslint |

### 12.2. Вопросы, которые должен решить владелец

1. **Расширять ли `pages.md` FSD-карты SEO-колонками** (`indexable`, `rendering`,
   `changefreq`) — или завести локальный kind `docs/stack/seo.md` во фронт-форке?
   Первое меняет канон в `business-strategy-template` (общий для всех проектов),
   второе оставляет карту нетронутой, но разносит знание о маршруте по двум репо.
2. **Как переосмыслить `shared-api.md`** для контентной поверхности (§10.5, п. 3).
   Нужен ли отдельный kind `content.md`?
3. **Апгрейд ESLint 9 → 10 в SPA-шаблоне** — делать ли заодно (сейчас там
   `@eslint/js@^10.0.1` с `eslint@^9.20.0`, peer уже нарушен), или SSR-шаблон
   уезжает на 10 в одиночку?
4. **`dependency-cruiser` как второй контур** в SvelteKit/Nuxt-ветке — нужен или
   лишний? (Для Astro вопрос не стоит: `.astro` не поддержан.)
5. **`import-x/no-cycle`** — добавлять ли проверку циклов между слайсами
   (Steiger и boundaries её не делают)?
6. **Негативные фикстуры гейта** (`.gate-fixtures/`, отдельный прогон «линтер
   обязан упасть») — принимаем ли как обязательную часть шаблона? Это
   единственная защита от молчаливых деградаций R1/R6.
7. **Playwright-бюджет JS на страницу** — вводим ли как обязательный e2e-тест
   (в дополнение к `size-limit`)? Для контент-first это ключевая метрика.

### 12.3. Что осталось непроверенным

- Typed-lint (`projectService`) на `.astro/.svelte/.vue` в большом проекте —
  измерена только холодная стоимость ESLint на 13 файлах.
- `lefthook` 1→2 и `@commitlint/cli` 19→21 — мажоры не прогонялись.
- `entryFileNames` с префиксом острова в Astro 7 (вариант 2 в §7.2).
- Тест «весь контент проходит Zod-схему» через `import.meta.glob` для
  SvelteKit/Nuxt (§6.6).
- `@nuxt/test-utils` с `environment: 'nuxt'`.
- Реальные времена `build`/`typecheck` по фреймворкам — они у спайк-потоков.

---

## 13. Источники

**Исходники пакетов (чтение `node_modules`, 2026-09-16)**
- `@feature-sliced/steiger-plugin@0.7.0` — `dist/index.js` (экстракторы 274–380,
  `indexSourceFiles` 155–185, `resolveDependency` 240–256, правила 52–1290),
  `dist/parsers/tree-sitter-{tsx,svelte,astro,vue}.wasm`
- `@feature-sliced/filesystem@3.1.1` — `dist/index.js` (`resolveImport` 148,
  `isIndex` 120, `getIndexes` 114)
- `@biomejs/biome@2.5.13` — `configuration_schema.json` (`HtmlConfiguration`,
  `HtmlFormatterConfiguration`, `SelfCloseVoidElements`, `WhitespaceSensitivity`)
- `eslint-plugin-astro@3.1.0/3.2.0` — `lib/index.mjs:3390–3511`
  (`requireUserLocal('eslint-plugin-jsx-a11y')`)
- `dependency-cruiser@18.3.1` — `src/extract/transpile/meta.mjs`
  (`EXTENSION2AVAILABLE`), вывод `depcruise --info`

**Документация**
- Biome — матрица поддержки языков: <https://biomejs.dev/internals/language-support/>
- Biome 2.3 — анонс полной поддержки Vue/Svelte/Astro: <https://biomejs.dev/blog/biome-v2-3/>
- Biome — changelog: <https://biomejs.dev/internals/changelog/>
- Vitest — миграция 4 → 5: <https://vitest.dev/guide/migration>
- Astro — configuration reference: <https://docs.astro.build/en/reference/configuration-reference/>
- SvelteKit — configuration: <https://svelte.dev/docs/kit/configuration>
- Nuxt 4 — nuxt.config: <https://nuxt.com/docs/4.x/api/nuxt-config>
- Nuxt 4 — directory structure: <https://nuxt.com/docs/4.x/directory-structure>
- eslint-plugin-astro: <https://github.com/ota-meshi/eslint-plugin-astro>
- eslint-plugin-boundaries, миграции v5→v6→v7: <https://www.jsboundaries.dev/docs/releases/migration-guides/v6-to-v7/>
- size-limit — releases: <https://github.com/ai/size-limit/releases>

**Steiger — issue/PR**
- PR #235 «feat: replace precinct with tree-sitter»: <https://github.com/feature-sliced/steiger/pull/235>
- Issue #116 «Support Svelte»: <https://github.com/feature-sliced/steiger/issues/116>
- Issue #94 «References to features aren't detected in a Nuxt setup»: <https://github.com/feature-sliced/steiger/issues/94>
- Issue #225 «ERR_PACKAGE_PATH_NOT_EXPORTED» (открыт): <https://github.com/feature-sliced/steiger/issues/225>

**npm registry (все версии проверены 2026-09-16)** — сводка в §5.1 и по тексту;
запрос воспроизводится скриптом `tooling-lab/.npmsweep.mjs`.

**Репозитории stit (read-only)**
- `spa-frontend-template`: `steiger.config.ts`, `eslint.config.js`, `biome.json`,
  `vitest.config.ts`, `vitest.setup.ts`, `.size-limit.cjs`, `lefthook.yml`,
  `.commitlintrc.cjs`, `package.json`, `.claude/rules/*`, `.claude/skills/scaffold/SKILL.md`
- `business-strategy-template`: `docs/projects/_template/fsd/README.md`
  и `_template/{entities,pages,widgets,app,shared-api,shared-lib}.md`
- спайки раунда 2 (чтение): `spike-astro/{astro.config.ts,steiger.config.ts,eslint.config.js,biome.json,vitest.config.ts,.size-limit.cjs,e2e/playwright.config.ts}`,
  `spike-sveltekit/{svelte.config.js,package.json}`, `spike-nuxt/{nuxt.config.ts,package.json}`,
  `spike-next/` (структура `src/views`)

**Артефакты лаборатории (воспроизводимые прогоны)**
```
tooling-lab/
├─ steiger-matrix/{gen.mjs,steiger.config.ts,tsconfig.json,.out-matrix.txt,.out-insig.txt}
├─ src/**                       фикстуры трёх форматов с 12 заложенными нарушениями
├─ .out-steiger-baseline.txt    Steiger: 6 из 12
├─ .out-eslint-baseline.txt     ESLint: 17 (включая все 6 пропущенных)
├─ .dependency-cruiser-v2.cjs + .out-depcruise2.{txt,json}
├─ resolve-probe.mjs            доказательство NULL-резолва ts.resolveModuleName
├─ ast-probe.mjs                AST astro-eslint-parser
├─ biome-exp/{off,on}/          12 ложных срабатываний vs 0
├─ biome-fmtexp/{off,on,*-pass1}/  идемпотентность форматирования
├─ biome-sc/, biome-ov/         selfCloseVoidElements, overrides
├─ a11y-exp/{eslint.astro.js,eslint.svelte.js,simple.svelte}  a11y в трёх форматах
├─ fw-layouts/{astro-b,sveltekit,sveltekit-pages,nuxt}/       раскладки фреймворков
│  └─ {fsd-boundaries.js,eslint.astro.js,eslint.sveltekit.js,eslint.nuxt.js}
├─ nri/                         семантика no-restricted-imports
├─ astro-fsd/                   Astro 7 + Vitest 5 + Container API + axe (3 passed)
├─ vitest-lab/                  Svelte 5 + Vue 3 + Vitest 5 + axe (2 passed)
├─ sizelab/                     size-limit 14 на реальном dist spike-astro
└─ .npmsweep.mjs                сводка версий npm
```
