# Негативные фикстуры гейта

Мини-проекты с заведомыми нарушениями. `pnpm check:gate` (`scripts/check-gate.mjs`) гоняет на
них **корневые** конфиги линтеров и **собственные скрипты гейта** и падает, если найденное хоть
в чём-то расходится с `expected.json`: ожидаемое нарушение не поймано (правило выключено,
понижено до warn, проверка в скрипте ослаблена) или поймано лишнее (ожидание удалено —
`expected.json` урезан). Пустая секция — тоже ошибка: гейт на гейт выключен. Это защита от
молчаливых деградаций: Steiger fail-open на нерезолвимых импортах, `eslint-plugin-astro` без
`eslint-plugin-jsx-a11y` разворачивает a11y-конфиг в ноль правил, `boundaries` без резолвера не
видит `@/`-импорты, правка `seo:check` «под новую коллекцию» тихо выключает сверку.

## Линтеры — `src/`

ESLint, Steiger и Biome гоняются из этого каталога по `src/` (ESLint — ещё и по `.claude/`:
вложенный worktree агента lint не видит, и находок там быть не должно); считаются только ошибки
(severity error). В `expected.json` — `{ file, rule, count }`, `count` по умолчанию 1.

| файл | нарушение | ловит |
|---|---|---|
| `src/widgets/a/ui/a.astro` | cross-slice `widgets/a → widgets/b`: через `@/widgets/b` во frontmatter и в клиентском `<script>` (там это ещё и не клиентский модуль), относительным путём в `.astro`-цель | ESLint `boundaries/dependencies` ×3 и `no-restricted-imports`, Steiger `fsd/forbidden-imports` |
| `src/widgets/b/lib/crumbs.js` | cross-slice `widgets/b → widgets/a` из `.js`-модуля | ESLint `boundaries/dependencies`, Steiger `fsd/forbidden-imports` |
| `src/features/search/ui/search-box.astro` | клиентский `<script>` импортирует `@/shared/config` (Zod и env процесса в бандле) | ESLint `no-restricted-imports` |
| `src/components/promo.astro` | файл вне слоёв FSD | ESLint `boundaries/no-unknown-files` |
| `src/widgets/a/ui/a.astro` | `<img>` без `alt` (и сырой `<img>` мимо `<Picture>`) | ESLint `astro/jsx-a11y/alt-text` и `no-restricted-syntax`, Biome `lint/a11y/useAltText` |
| `src/widgets/promo/ui/promo.astro` | канон UI и приложения: CSS UI-кита, `process.env` и `console` во frontmatter; сырой `<img>`, `client:load`, инлайн-`style`, сырой цвет в классе, в `fill` SVG и в `<style>` | ESLint `no-restricted-imports`, `no-restricted-properties`, `no-console`, `no-restricted-syntax` ×6 |
| `src/entities/post/ui/post-card.astro` | импорт вверх `entities → widgets` | ESLint `boundaries/dependencies`, Steiger `fsd/forbidden-imports` |
| `src/pages/index.astro` | deep-import в `.astro`-цель и в `.ts`-цель (над вторым — `eslint-disable-next-line`, который не действует), относительным путём из слайса в каталог слоя | ESLint `no-restricted-imports` ×3, Steiger `fsd/no-public-api-sidestep` (только `.ts`) |
| `src/entities/post/index.ts` | реэкспорт `astro:content` из public API | ESLint `no-restricted-imports` |
| `src/features/search/index.ts` | импорт и объявление в баррели вместо `export { x } from` | ESLint `no-restricted-syntax` ×2 |
| `.claude/worktrees/agent/src/x.ts` | `any` в чужом worktree | ничем: каталог в ignores ESLint |

Обвязка: `tsconfig.json` (extends корневого, свои `paths`), `eslint.config.js` и
`steiger.config.ts` (реэкспорт корневых — паттерны считаются от этого каталога),
`biome.gate.json` (extends корневого, без исключения `.gate-fixtures`).

## Скрипты гейта — `seo/`, `links/`, `content/`

Каждый каталог — корень мини-проекта (`dist/client`, `src/pages`, контент коллекций,
`content/redirects.yaml` и свой реестр коллекций `scripts/lib/content.mjs`), скрипт запускается
с ним аргументом: `node scripts/seo-check.mjs .gate-fixtures/seo`. Реестр скрипт берёт из
проверяемого корня, поэтому коллекции сайта — новая по `/scaffold collection`, переименованная
или удалённая прунингом — фикстур не касаются. В `expected.json` — строки нарушений ровно так,
как скрипт их печатает; где дальше идёт текст сторонней библиотеки (Zod, js-yaml), строка
ожидания обрывается на `…` и сверяется по началу — обновление зависимости гейт не роняет, а свои
сообщения скриптов на `…` не заканчиваются.

| каталог | скрипт | что заложено |
|---|---|---|
| `seo/` | `seo:check` | по странице на группу правил: два `<title>` и два `h1`, дубль title, чужой и двойной canonical, `lang` и `og:locale` не той локали, сломанный Open Graph (`og/`, `og2/`), неверные hreflang (`hreflang/`, `xdefault/`), служебная страница с canonical и OG, пустой head с keywords и комментарием, чужие и запрещённые типы JSON-LD и сломанные крошки, главная без WebSite; пары переводов против источника: запись без hreflang и невзаимный перевод, взаимный hreflang между записями с разными `translationKey`, опубликованная запись и маршрут `src/pages` без страницы в сборке, запись реестра без каталога; политика сборки: сниппет общий, из двух слов и длиннее бюджета, `noindex` вне списка (и разрешённый — `contacts/spasibo`), скрипты вне островов, внешний и в `<body>`, обработчик `onclick` и `javascript:`-адрес (и разрешённый остров на главной), `noindex` адресом Googlebot прописными (`bot/`), свой origin в теле и сборка с доменом — canonical, og:image и hreflang на нём (`domen/`), картинки без размеров и LCP с `lazy`, ресурсы с чужих origin (и фон в `style`) и шрифт без `font-display` (в `<style>` и в `_astro/site.css`), статья с разметкой не про эту страницу, LocalBusiness с невидимыми фактами и Organization вне главной, крошки без BreadcrumbList, страница черновика; законное без нарушений — типографика с неразрывными пробелами в h1, крошках и имени организации — символом и сущностями `&nbsp;`, `&#160;`, `&laquo;` (`tipografika/`, `o-nas/`), оглавление и нумерованная пагинация в `<nav><ol>` (и с текущей страницей последней), `rel="me"` на чужой домен, «JavaScript:» и «onclick=» в тексте атрибута (главная), prerendered-эндпоинт `feed.json` |
| `links/` | `check:links` | несуществующая страница и картинка в `srcset`, хвостовой слеш, `.html`, адрес из `redirects.yaml`, относительная ссылка; живые цели — страница, on-demand маршрут, внешняя ссылка, якорь, `mailto:` |
| `content/` | `check:content` | тело записи нарушает каждое правило по разу (`telo.md`), дубль сниппета и `translationKey`, поле вне схемы, битый YAML, файл без frontmatter, плохой slug, чужая локаль и вложенный каталог, ссылка на черновик, `redirects.yaml` на живой и несуществующий маршрут, каталог контента вне реестра коллекций (`vne-reestra/`) и запись реестра без каталога |

## Как менять

Новое правило границ в корневом конфиге или новая проверка в скрипте гейта — новое нарушение в
фикстуре + строка в `expected.json` тем же коммитом. Изменился текст сообщения скрипта или
линтер стал находить больше — `expected.json` правится вслед, осознанно: расхождение и есть
сигнал. Каталог исключён из обычных прогонов (`tsconfig`, `biome.json`, `eslint.config.js`,
`.dockerignore`); мини-сборки `*/dist` — в git (`.gitignore` их не прячет).
