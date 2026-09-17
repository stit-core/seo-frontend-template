# Три режима ведения сеанса

`stack-deep-dive` поверх базовых выборов шаблона (Vite 8, React 19.2, TanStack,
Tailwind v4, MSW, …) решает **проектные** вариации. Три сценария входа.

## A. Заведение

**Сигнал**: args = `<kind>`, для которого `docs/stack/<kind>.md` ещё нет.

### Шаги

1. Прочитать `docs/stack/README.md` — освежить контракт.
2. Скопировать шаблон: `cp docs/stack/_templates/<kind>.md docs/stack/<kind>.md`.
3. Заполнить frontmatter (`kind`, `status: draft`) — тривиально из имени файла,
   без AskUserQuestion.
4. Перейти в режим C на свежезаведённом артефакте.

Если в сводке `K из 8 файлов нет` — предложить через `AskUserQuestion`: завести
все недостающие сразу (минимальный frontmatter + draft) или только выбранный.

## B. Сырьё

**Сигнал**: args = свободный текст / приложение (текущий `vite.config.ts`,
`package.json`, описание деплоя, env-список).

### Шаги

1. Прочитать материал внимательно.
2. Извлечь платформенные решения и привязать каждое к одному из 8 kind'ов:
   имя сервиса/registry → `service`; node/browser target/React Compiler →
   `runtime`; env'ы и секреты → `config`; layouts/guards/preload → `routing`;
   контракт API/auth/mock → `api`; оси темизации → `styling`;
   Sentry/web-vitals → `observability`; проектные deps → `dependencies`.
3. Показать план через чат, подтвердить волной `AskUserQuestion`.
4. Завести/обновить артефакты как драфты. Дыры по обязательным секциям —
   `**blocker**` в `state/<kind>.md`.

### Что НЕ делать в режиме B

- Не объявлять извлечённое «зафиксированным» — кандидаты до подтверждения.
- Не угадывать `Generates` — это контракт de-template, обдумывается явно.
- Не выдумывать env-имена / версии — только то, что явно в материале.

## C. Углубление

**Сигнал**: args = `<kind>` существующего артефакта, либо выбран из сводки.

### Шаги

1. Прочитать файл артефакта целиком.
2. Прочитать `state/<kind>.md`, если есть.
3. Прочитать соседей по cross-kind sync (`config`/`runtime` — роллапы; правишь
   `observability`/`api`/`styling` → проверь, что их env/DSN доехали в `config`).
4. Прогнать обязательные секции по `references/field-checklists.md`. Найти:
   пустые секции; anti-pattern-подозрения; **пустой/TBD-`Generates`** (главная
   дыра — без неё артефакт бесполезен de-template); cross-kind drift.
5. Раунд `AskUserQuestion` (до 4 вопросов) — точечно по дырам.
6. Применить ответы через `Edit`. Mirror-обновление `config` — черновиком,
   потом подтвердить.
7. Прогнать `references/draft-stable.md`. Все ✅ → промоушн.

## Каскады / cross-kind drift

`config.md` — роллап env всех kind'ов: env, объявленный любым артефактом, обязан
быть в `config.md § Runtime config keys` или `§ Build-time env`. Drift помечается
`**blocker**` в `state/config.md`, чтобы не забылось при промоушне.

## Стиль вопросов

- Не спорить о базовых выборах шаблона (Vite vs Webpack) — это решено, обсуждение
  отдельным issue в шаблонном репо.
- Имена сервиса/registry/env — Other (архитектор называет, не скилл).
- Не добавлять проектные deps без записи в `dependencies.md`.
- Не закрывать сессию без чек-листа хотя бы по одному правленому артефакту.
