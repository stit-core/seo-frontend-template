# Негативные фикстуры гейта

Мини-проект с заведомыми нарушениями. `pnpm check:gate` (`scripts/check-gate.mjs`) гоняет
на нём **корневые** конфиги ESLint, Steiger и Biome и падает, если хотя бы одно ожидаемое
нарушение из `expected.json` не поймано **с severity error** (правило, понижённое до warn,
считается непойманным). Это защита от молчаливых деградаций: Steiger fail-open на
нерезолвимых импортах, `eslint-plugin-astro` без `eslint-plugin-jsx-a11y` разворачивает
a11y-конфиг в ноль правил, `boundaries` без резолвера не видит `@/`-импорты.

Что заложено:

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

Новое правило границ в корневом конфиге — новая фикстура здесь + строка в `expected.json`.
Каталог исключён из обычных прогонов (`tsconfig`, `biome.json`, `eslint.config.js`, `.dockerignore`).
