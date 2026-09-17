# Промоушн draft → stable (stack)

Контракт перевода артефакта `docs/stack/<kind>.md` в `status: stable`.

## Чек-лист

1. **Все секции заполнены** или явно `_нет_`:
   - `service.md` § Идентичность / Связь с экосистемой
   - `runtime.md` § Node / Browser / React
   - `config.md` § Runtime config keys / Build-time env / Секреты
   - `routing.md` § TanStack Router / Layouts / Guards
   - `api.md` § HTTP-клиент / Контракт API / Auth / Mock
   - `styling.md` § Источники / Оси темизации
   - `observability.md` § Sentry / Web Vitals
   - `dependencies.md` § Базовая подборка (зафиксирована) / Проектные / Запрещено

2. **Generates непуст** — конкретные файлы, которые правит `/de-template`.

3. **Cross-kind согласованность**:
   - `config.md#API_BASE_URL` совпадает с тем, что использует `shared/config`
   - `api.md#Контракт API` описывает, где живут zod-схемы
   - `observability.md#DSN` (если активен) — есть в `config.md`
   - `dependencies.md` не противоречит установленному `package.json`

4. **Нет открытых `**blocker**`-вопросов** в `state/<kind>.md`
   (формат — `references/state-format.md`).

## Эскалация при сомнении

Те же правила что у fsd-deep-dive — `**blocker**`-строка в `## Открытые
вопросы` заметки `state/<kind>.md`, не промоушать.
