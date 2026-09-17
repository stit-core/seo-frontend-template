# Getting Started

> [META] Этот файл предназначен **только для потребителя шаблона**.
> `/de-template` удаляет его при первом разворачивании в проект.

## Что это

Шаблон React SPA на TypeScript для stit-проектов. Жёсткий FSD,
TanStack Router/Query, MSW для mock-режима, UI-компоненты пишутся в
проекте на собственном токен-слое (design-system-agnostic). После форка
ты пройдёшь несколько этапов проектирования, и репо разверётся в
самостоятельный проект, не помнящий про шаблон.

## Путь

```
0. Use this template на Gitea → клон → pnpm install
1. /smartdev          → сводка состояния
2. /init-service      → оркестратор онбординга:
   ├─ привязка к FSD-карте из ../strategy (проектируется там его /fsd-deep-dive)
   ├─ /stack-deep-dive → проектирование стека (docs/stack/*)
   ├─ gate: stack stable + stable-записи FSD-карты + state чист
   ├─ /de-template    → разворот фундамента, prune reference-слайсов
   └─ /scaffold       → для каждого своего слайса
3. pnpm dev → SPA крутится в mock-режиме
4. (когда бэк появится) zod-схемы сущностей по контракту → переключи VITE_API_MODE=real
5. pnpm check → /release → образ в registry → rollout в <org>/infra (make bump)
```

## Шаг 0: подготовка

```bash
# Node 24 (через nvm/asdf)
nvm use

# pnpm 10 через corepack
corepack enable
corepack prepare pnpm@10 --activate

# Зависимости
pnpm install

# Git-хуки
pnpm prepare   # lefthook install
```

## Шаг 1: смартдев

В Claude Code:

```
/smartdev
```

Покажет состояние: ветка, drift, активный план, gate'ы. На свежем форке
скажет «начни с /init-service».

## Шаг 2: /init-service

Скил сам проводит по этапам:

1. **Привязка к FSD-карте** — карта слайсов проектируется в соседнем
   `<org>/strategy` (слой `docs/projects/<slug>/fsd/<surface>/`, его
   `/fsd-deep-dive`); здесь фиксируются поля `project-slug` / `strategy-path`
   (дефолт `../strategy`) / `surface` в `docs/stack/service.md`. Соседа нет —
   скил подскажет спроектировать карту там и вернуться.
2. **`/stack-deep-dive`** — добивает `docs/stack/{service,runtime,config,routing,api,styling,observability,dependencies}.md`
   поверх базовых выборов шаблона.
3. После stable (stack + записи FSD-карты) запускает **`/de-template`** —
   переименование пакета, обновление README, генерация nginx env-set,
   удаление reference-слайсов.

## Шаг 3: разработка

```bash
pnpm dev              # mock-режим по умолчанию (VITE_API_MODE=mock)
```

В левом нижнем углу — мини-панель переключателя mock-сценариев
(`empty | populated | authenticated | error`). Состояние сохраняется
в `localStorage` (`app.mock.db.v1`), кнопка **reset** чистит.

Когда появится бэк:

```bash
# .env.local
VITE_API_MODE=real
VITE_API_TARGET=https://api.dev.example.com
```

Контракт API описывается рукописными zod-схемами в
`src/entities/<name>/model/schema.ts` (`/openapi.json` бэка — референс);
ответы парсятся схемой прямо в `queryFn`/`mutationFn`.

## Gate перед push

```bash
pnpm check   # typecheck + lint + format:check + test + steiger + size + build
```

Lefthook `pre-push` запускает то же самое автоматически.

## Когда что-то идёт не так

- **`/smartdev`** покажет состояние и подскажет, в какой режим/скил идти
- **Артефакты не stable** → стек — `/stack-deep-dive` здесь; FSD-карта —
  `/fsd-deep-dive` в `<org>/strategy`
- **Reference-слайсы мешают** — удаляются `/de-template` (см. его references/prune.md)
