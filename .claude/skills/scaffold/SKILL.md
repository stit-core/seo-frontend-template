---
name: scaffold
description: Интерактивно разложить один FSD-слайс (entity/feature/widget/page) по канону — папка с ui/model/api/lib/config + index.ts + пустые тесты + (для page) route + (если просит) mock-handler. Источник слайса — stable-запись FSD-карты в соседнем <org>/strategy (docs/projects/<slug>/fsd/<surface>/); src/-пути скилл выводит сам из kind + slug. Активируй когда юзер говорит "/scaffold", "создай слайс X", "добавь страницу Y", "новый widget Z", или когда оркестратор /init-service / /de-template чейнит этап реализации.
---

# Skill: scaffold

Раскладывает один слайс по FSD-канону за один проход. Не интервьюирует про
бизнес — карта слайсов проектируется в `<org>/strategy` (его
`/fsd-deep-dive`). Скилл детерминированно создаёт файлы по stable-записи
из `<strategy-path>/docs/projects/<slug>/fsd/<surface>/<kind>.md`
(резолв — поля `project-slug`/`strategy-path`/`surface` в
`docs/stack/service.md`, дефолт `../strategy`); `src/`-пути выводит сам из
kind + slug — в карте их нет.

## Когда применять

- "/scaffold" + аргумент (slice / page / widget / entity / feature)
- Юзер: «создай слайс X», «добавь страницу Y», «новый widget Z»
- Оркестратор `/init-service` или `/de-template` чейнит этап «свои слайсы»

## Pre-flight

- [ ] Запись слайса есть в FSD-карте strategy (`fsd/<surface>/<kind>.md`) со
      `status: stable`; нет соседа/записи — next-step «спроектируй в
      `<org>/strategy` (/fsd-deep-dive)», не выдумывать слайс здесь
- [ ] Имя слайса в kebab-case, не конфликтует с существующими

## Вопросы юзеру (≤ 3, не интервью)

1. **Тип** — `entity | feature | widget | page` (из `/scaffold <type>`-аргумента)
2. **Имя слайса** — kebab-case (`create-todo`, `payment-status`)
3. **Что нужно** — какие сегменты создать:
   - `ui/` (всегда для feature/widget/page; опционально для entity)
   - `model/` (всегда для entity; для feature если есть store/schema)
   - `api/` (для entity всегда; для feature если есть mutation; для widget/page редко)
   - `lib/` (опционально)
4. **Сопутствующее** — нужен ли:
   - test stub (`*.test.tsx`) — да по умолчанию
   - mock-handler в `shared/api/mock/handlers/<slice>.ts` (для entity/feature
     с API) — да если есть `api/`
   - route в `pages/` (только для page) — обязательно

## Раскладка

### entity

```
src/entities/<slug>/
├─ model/types.ts          # Zod schema + type
├─ api/queries.ts          # queryOptions + мутации
├─ ui/<slug>-card.tsx      # presenter (опционально)
├─ index.ts                # public API
└─ model/types.test.ts     # schema-тест
```

### feature

```
src/features/<slug>/
├─ ui/<slug>-form.tsx      # основной компонент
├─ model/schema.ts         # Zod input schema (если форма)
├─ api/<slug>.ts           # mutation (если есть)
├─ index.ts
└─ ui/<slug>-form.test.tsx
```

### widget

```
src/widgets/<slug>/
├─ ui/<slug>.tsx
├─ index.ts
└─ ui/<slug>.test.tsx
```

### page

```
src/pages/<slug>.tsx       # TanStack Router file-based
└─ test (опционально — e2e лучше для page-уровня)
```

После записи файла page — `pnpm gen` регенерирует `routeTree.gen.ts`.

## Public API (обязательно)

`index.ts` — explicit re-exports:

```ts
export { LoginForm } from './ui/login-form'
export { useLoginMutation } from './api/login'
export { LoginSchema, type LoginInput } from './model/schema'
```

**Не `export *`** — теряем discoverability и tree-shake.

## Mock handler (если нужен)

`src/shared/api/mock/handlers/<slug>.ts`:

```ts
import { http, HttpResponse } from 'msw'
import type { DB } from '../db'

export function <slug>Handlers(db: DB) {
  return [
    http.get('/api/v1/<resource>', () => HttpResponse.json([])),
    // …
  ]
}
```

Зарегистрировать в `src/shared/api/mock/handlers/index.ts`.

## После раскладки

- `pnpm steiger src` — должен быть зелёным (slice canonical, public API на месте)
- `pnpm typecheck` — нет битых импортов
- `pnpm lint` — формат / правила в порядке

## Что НЕ делать

- ❌ Создавать сегменты `components/`, `hooks/`, `utils/`, `types/` — это
  группировка по типу, запрещено каноном (Steiger `no-reserved-folder-names`)
- ❌ `export * from './...'` в `index.ts`
- ❌ Импортировать из соседнего слайса того же слоя
- ❌ Создавать слайс «на будущее» (Steiger `insignificant-slice`)
