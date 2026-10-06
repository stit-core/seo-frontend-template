# Вклад в ssr-frontend-template

Это форкаемый шаблон индексируемого сайта на стеке stit (Astro 7 + Node). Вклад полезен,
когда он делает шаблон чище, надёжнее или удобнее для того, кто разворачивает из него
свой сайт — не когда он зашивает специфику конкретного продукта.

## С чего начать

- Прочитай `CLAUDE.md` (ядро + роутер) и `docs/README.md` (карта документации);
  правила — `.claude/rules/`, устройство агент-обвязки — `docs/contributing.md`.
- Подними окружение:

  ```bash
  nvm use && corepack enable && corepack prepare pnpm@10 --activate
  pnpm install
  pnpm prepare        # lefthook git-hooks
  pnpm dev            # http://localhost:4321
  ```

## Принципы

- **FSD строго нисходяще** — `app → pages → widgets → features → entities → shared`;
  границы держит ESLint (`pnpm lint`), структуру — Steiger. Rule `fsd-architecture`.
- **Public API** — `index.ts` с explicit re-exports, без своего кода и примитивов `astro:*`;
  клиентский `<script>` импортирует только модули без серверного кода.
- **UI — `.astro` на собственном токен-слое** (`src/app/styles/index.css`), без вендорных
  UI-китов. Rule `shared-ui`.
- **0 JS на контентных страницах**; остров — по решению и под бюджетом: файл в `dist` —
  строка в `.size-limit.cjs`, инлайн — байты в своём unit-тесте.
- **`SITE_URL` — runtime**: плейсхолдер сборки штампуется при старте. Rule `env-local`.
- **Forward-only документация**: текст описывает текущее состояние, история — в `git log`.

## Форк, issue, PR

- **Issue** — для багов и предложений: что наблюдаешь, как воспроизвести, ожидаемое
  поведение.
- **PR** — форкни репозиторий, заведи ветку, открой pull request с понятным «зачем».
  Держи PR сфокусированным.
- Правка `docker/*`, `.npmrc`, `package.json#dependencies`, новый остров или новая
  интеграция Astro — обоснование в PR отдельно.

## Перед PR

```bash
pnpm check      # gate: plan:check + typecheck + lint + format:check + test + steiger
                #       + check:gate + check:content + build + check:links + seo:check
                #       + size + test:http (HTTP-набор на prod-сервере)
pnpm test:e2e   # браузерный набор (axe, тема, форма без JS) — обязательный шаг /release
```

- **Conventional Commits** (commitlint): `<type>(<scope>)?: <subject>`, subject ≤ 72.
  Типы: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `meta`, `perf`, `style`.

## Стиль

Спокойно и по делу. **Biome** (TS/JS/JSON/CSS) и **Prettier** (`*.astro`) для формата,
**ESLint** для правил, **TypeScript strict**. Комментарии — только когда WHY неочевидно,
по-русски.

## Лицензия

Контрибьютя, ты соглашаешься, что вклад выходит под лицензией **Apache-2.0** —
той же, под которой распространяется репозиторий (см. `LICENSE`).
