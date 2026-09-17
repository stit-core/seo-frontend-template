# Вклад в spa-frontend-template

Это форкаемый шаблон React SPA на стеке stit. Вклад полезен, когда он делает
шаблон чище, надёжнее или удобнее для того, кто разворачивает из него своё
приложение — не когда он зашивает специфику конкретного продукта.

## С чего начать

- Прочитай `CLAUDE.md` (ядро + роутер) и `docs/README.md` (карта документации);
  FSD-архитектура и слои — `docs/reference/architecture.md`.
- Подними окружение:

  ```bash
  nvm use && corepack enable && corepack prepare pnpm@10 --activate
  pnpm install
  pnpm prepare        # lefthook git-hooks
  pnpm gen:msw        # Service Worker для MSW
  pnpm dev            # mock-режим → http://localhost:5173
  ```

- Reference-слайсы (`features/auth`, `pages/profile`, `pages/todos`,
  `features/theme`) — учебные образцы (изучить, потом удалить через `/de-template`);
  правки в них уместны только если чинят сам референс.

## Принципы

- **FSD строго нисходяще** — `app → pages → widgets → features → entities → shared`.
  Между слайсами одного слоя импорт запрещён; только вниз через public API. Steiger +
  `eslint-plugin-boundaries` enforce'ят.
- **Public API** — `index.ts` на каждом слайсе/сегменте, explicit re-exports (не `export *`).
- **UI-компоненты пишутся в проекте, design-system-agnostic.** Внешней DS нет;
  компоненты опираются только на собственный токен-слой (`src/app/styles/index.css`,
  тема через `data-scheme`) — в `shared/ui/` (переиспользуемое) или `ui/`-сегменте
  слайса. Rule `shared-ui`.
- **Секреты не в бандле.** Access-token не в localStorage; в `import.meta.env.VITE_*` —
  только не-секретное (попадает в публичный бандл). Детали — rule `env-local`.
- **Forward-only документация.** Текст описывает текущее состояние, без «было/стало» —
  история живёт в `git log`.

## Форк, issue, PR

- **Issue** — для багов и предложений: что наблюдаешь, как воспроизвести, ожидаемое
  поведение.
- **PR** — форкни репозиторий, заведи ветку, открой pull request с понятным описанием
  «зачем». Держи PR сфокусированным; не подмешивай несвязанные правки.
- Правка `docker/*`, `.npmrc`, `package.json#dependencies` или FSD-структуры (новый
  слой, переименование сегментов) — опиши обоснование в PR отдельно.

## Перед PR

```bash
pnpm check    # gate: typecheck + lint + format:check + test + steiger + size + build
```

Зелёный `pnpm check` — gate пройден (его же гоняет `lefthook pre-push`). E2E
(`pnpm test:e2e`) — отдельный stage, не в gate.

- **Conventional Commits** (commitlint): `<type>(<scope>)?: <subject>`, subject ≤72.
  Типы: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `meta`, `perf`, `style`.
  Пример: `feat(profile): add avatar upload`.

## Стиль

Спокойно и по делу, без хайпа. **Biome formatter** + **ESLint flat config**
обязательны, **TypeScript strict** (без `as any` без явной причины). React Compiler
делает полный проход — без ручных `useMemo`/`useCallback`/`memo` кроме обоснованных
случаев. Комментарии — только когда WHY неочевидно, не пересказ кода.

## Лицензия

Контрибьютя, ты соглашаешься, что вклад выходит под лицензией **Apache-2.0** —
той же, под которой распространяется репозиторий (см. `LICENSE`).
