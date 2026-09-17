---
id: stack.api
kind: api
name: api
status: draft
---

# api

## HTTP-клиент

Собственный тонкий враппер поверх native `fetch` (`shared/api/client.ts`).
CSRF-заголовок на mutating requests. Cookie-auth (`credentials: 'include'`).

## Контракт API

- Кодогена нет: контракт описывается **рукописными zod-схемами** в
  `entities/<name>/model/schema.ts`
- Клиент возвращает `unknown`, ответ парсится схемой на вызывающей стороне
- `<backend>/openapi.json` (если есть) — референс при написании схем

## Auth scheme

| механизм | детали |
|---|---|
| session storage | httpOnly cookie `app_session` |
| token type | _opaque / JWT_ |
| CSRF | double-submit cookie `csrf_token` + header `X-CSRF-Token` |
| refresh | _автообновление через interceptor / explicit_ |

## Mock-стратегия

- MSW 2.x + `@mswjs/data` + `@faker-js/faker`
- Сценарии: `empty | populated | authenticated | error`
- Персист: `localStorage` под ключом `app.mock.db.v1`
- Dev-UI переключатель в углу

## Generates

- `src/shared/api/client.ts`
- `src/shared/api/mock/*`
- `src/entities/<name>/model/schema.ts` — zod-контракты сущностей

## Открытые вопросы

- _что_
