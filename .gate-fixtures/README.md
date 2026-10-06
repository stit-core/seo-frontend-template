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

ESLint, Steiger и Biome гоняются из этого каталога по `src/`; считаются только ошибки (severity
error). В `expected.json` — `{ file, rule, count }`, `count` по умолчанию 1.

| файл | нарушение | ловит |
|---|---|---|
| `src/widgets/a/ui/a.astro` | cross-slice `widgets/a → widgets/b`: через `@/widgets/b` во frontmatter и в клиентском `<script>`, относительным путём в `.astro`-цель | ESLint `boundaries/dependencies` ×3, Steiger `fsd/forbidden-imports` |
| `src/widgets/a/ui/a.astro` | `<img>` без `alt` | ESLint `astro/jsx-a11y/alt-text`, Biome `lint/a11y/useAltText` |
| `src/entities/post/ui/post-card.astro` | импорт вверх `entities → widgets` | ESLint `boundaries/dependencies`, Steiger `fsd/forbidden-imports` |
| `src/pages/index.astro` | deep-import в `.astro`-цель и в `.ts`-цель | ESLint `no-restricted-imports` (обе), Steiger `fsd/no-public-api-sidestep` (только `.ts`) |
| `src/entities/post/index.ts` | реэкспорт server-only `astro:content` из public API | ESLint `no-restricted-imports` |
| `src/features/search/index.ts` | импорт и объявление в баррели вместо `export { x } from` | ESLint `no-restricted-syntax` ×2 |

Обвязка: `tsconfig.json` (extends корневого, свои `paths`), `eslint.config.js` и
`steiger.config.ts` (реэкспорт корневых — паттерны считаются от этого каталога),
`biome.gate.json` (extends корневого, без исключения `.gate-fixtures`).

## Скрипты гейта — `seo/`, `links/`, `content/`

Каждый каталог — корень мини-проекта (`dist/client`, `src/pages`, контент коллекций,
`content/redirects.yaml`), скрипт запускается с ним аргументом: `node scripts/seo-check.mjs
.gate-fixtures/seo`. В `expected.json` — строки нарушений ровно так, как скрипт их печатает.

| каталог | скрипт | что заложено |
|---|---|---|
| `seo/` | `seo:check` | по странице на группу правил: два `<title>` и два `h1`, дубль title, чужой и двойной canonical, `lang` и `og:locale` не той локали, сломанный Open Graph (`og/`, `og2/`), неверные hreflang (`hreflang/`, `xdefault/`), служебная страница с canonical и OG, пустой head с keywords и комментарием, чужие и запрещённые типы JSON-LD и сломанные крошки, главная без WebSite; пары переводов против источника: запись без hreflang и невзаимный перевод, взаимный hreflang между записями с разными `translationKey`, опубликованная запись и маршрут `src/pages` без страницы в сборке |
| `links/` | `check:links` | несуществующая страница и картинка в `srcset`, хвостовой слеш, `.html`, адрес из `redirects.yaml`, относительная ссылка; живые цели — страница, on-demand маршрут, внешняя ссылка, якорь, `mailto:` |
| `content/` | `check:content` | тело записи нарушает каждое правило по разу (`telo.md`), дубль сниппета и `translationKey`, поле вне схемы, битый YAML, файл без frontmatter, плохой slug, чужая локаль и вложенный каталог, ссылка на черновик, `redirects.yaml` на живой и несуществующий маршрут, каталог контента вне реестра коллекций |

## Как менять

Новое правило границ в корневом конфиге или новая проверка в скрипте гейта — новое нарушение в
фикстуре + строка в `expected.json` тем же коммитом. Изменился текст сообщения скрипта или
линтер стал находить больше — `expected.json` правится вслед, осознанно: расхождение и есть
сигнал. Каталог исключён из обычных прогонов (`tsconfig`, `biome.json`, `eslint.config.js`,
`.dockerignore`); мини-сборки `*/dist` — в git (`.gitignore` их не прячет).
