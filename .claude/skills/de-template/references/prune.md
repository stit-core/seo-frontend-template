# Prune reference-слайсов

Учебные слайсы шаблона — это **живой образец**, не «технический долг».
Удаляются **после** того как собственные слайсы (из FSD-карты strategy
через `/scaffold`) уже сгенерированы и работают.

## Что удалить (8 точек)

1. `src/features/auth/` — Login-форма
2. `src/features/create-todo/`
3. `src/features/theme/` — оставить, если планируется i18n+тема (часто полезно)
4. `src/entities/session/`
5. `src/entities/user/`
6. `src/entities/todo/`
7. `src/pages/login.tsx`, `src/pages/profile.tsx`, `src/pages/todos.tsx`
8. `src/widgets/app-shell/` — **проверь**, что свой AppShell готов, иначе
   оставь как baseline и допиши под себя

## Что заменить (не удалять)

- `src/pages/index.tsx` — переписать под главную проекта (PageHeader + контент
  из своих widget/feature)
- `src/pages/__root.tsx` — оставить, но AppShell может быть свой

## Mock-handlers

В `src/shared/api/mock/handlers/`:

- `auth.ts`, `todos.ts`, `users.ts` — удалить (если auth не оставляем)
- `error.ts` — оставить (универсальный сценарий)
- Заменить на свои handlers по `shared-api.md § Сценарии данных` FSD-карты
  strategy (`fsd/<surface>/shared-api.md`)

`src/shared/api/mock/db.ts` — пересоздать factory под свои сущности
(см. `entities.md` FSD-карты strategy).

`src/shared/api/mock/seeds/factories.ts` — заменить `makeUser`/`makeTodo` на
свои `make<Entity>`.

`src/shared/api/mock/scenarios/index.ts` — переписать `seedPopulated` /
`seedAuthenticated` под свои сущности.

## Тесты reference-слайсов

Удалить `*.test.tsx` из удалённых слайсов. Свои тесты пишет `/scaffold`.

## После prune

```bash
pnpm steiger src     # должно быть зелёным — нет insignificant-slice
pnpm typecheck       # нет битых импортов
pnpm test            # тесты собственных слайсов проходят
pnpm build           # бандл собирается
```
