# Getting Started

> [META] Этот файл — **для потребителя шаблона**. `/de-template` удаляет его при первом
> разворачивании форка в проект.

## Что это

Шаблон индексируемого сайта: Astro 7 с Node-адаптером, контент — Markdown в git, ноль
JavaScript на контентных страницах, один Docker-образ на все среды. Всё, что должно
находиться в поиске, отдаётся первым HTML-ответом. Приложение за логином — другой
шаблон, `spa-frontend-template`.

После форка ты проходишь несколько этапов проектирования, и репозиторий разворачивается
в самостоятельный сайт, который про шаблон не помнит.

Форк живёт в проекте рядом с соседями: проект стартует в `<org>/strategy` (там проектируется и
FSD-карта сайта), дальше работа идёт из операционного хаба `<org>/infra`, откуда агенты приходят
сюда; прямой заход сюда — тоже нормальный режим. Карта и флоу —
[`reference/ecosystem.md`](./reference/ecosystem.md).

## Путь

```
0. Use this template на Gitea → клон → pnpm install
1. /smartdev          → сводка состояния
2. /init-service      → оркестратор онбординга:
   ├─ привязка к FSD-карте из ../strategy (проектируется там его /fsd-deep-dive)
   ├─ /stack-deep-dive → платформа: docs/stack/*.md до status: stable
   ├─ gate: стек stable + stable-записи карты + state чист
   ├─ /de-template    → идентичность, политика ПДн, прунинг reference-набора
   └─ /scaffold       → свои страницы, коллекции, виджеты
3. /content           → первые записи
4. pnpm check         → гейт
5. /seo-audit         → проверка выдачи
6. /release           → образ в registry → rollout в <org>/infra (make bump SVC=site)
```

## Шаг 0: подготовка

```bash
nvm use                                   # Node 24
npm i -g pnpm@10                          # точную версию проекта (packageManager) pnpm подтянет сам
pnpm install
pnpm prepare                              # lefthook git-hooks
pnpm dev                                  # http://localhost:4321
```

Демон Astro 7 останавливается `pnpm astro dev stop`.

Как в контейнере — прод-сборка с плейсхолдером origin, штамповка и обёртка сервера:

```bash
pnpm build
DIST_DIR=dist SITE_URL=http://localhost:3000 sh docker/entrypoint.sh pnpm start
```

## Шаг 1: `/smartdev`

Покажет состояние: ветка, активный план, развёрнут ли форк, какие артефакты `draft`.
На свежем форке скажет «начни с `/init-service`».

## Шаг 2: `/init-service`

Скилл ведёт по этапам:

1. **Привязка к FSD-карте.** Карта слайсов проектируется в соседнем `<org>/strategy`
   (`docs/projects/<slug>/fsd/<surface>/`, его `/fsd-deep-dive`); здесь фиксируются поля
   `project-slug` / `strategy-path` (дефолт `../strategy`) / `surface` в
   `docs/stack/service.md`. Соседа нет — скилл подскажет спроектировать карту там и
   вернуться.
2. **`/stack-deep-dive`.** Волнами заполняет `docs/stack/*.md` поверх дефолтов шаблона:
   имя и registry, источник контента и коллекции, маршруты и режимы, канонический хост и
   бренд, куда уходит форма, какие env. Формы приходят предзаполненными — подтверждаешь
   или меняешь.
3. **`/de-template`.** По stable-артефактам: имя пакета, идентичность сайта, реквизиты
   организации, **реквизиты оператора в политике обработки ПДн** (без них скилл не
   продолжает), тексты стартовых страниц, редиректы, прунинг reference-набора — с блогом
   или без.
4. **`/scaffold`.** Свои страницы (`page`), коллекции контента (`collection`), виджеты и
   служебные маршруты.

## Шаг 3: контент и проверка

```bash
/content              # запись по канону: бюджеты сниппета, translationKey, обложка
pnpm check:content    # схема, тело, ссылки, переводы, redirects.yaml
pnpm check            # полный гейт
```

Черновик (`draft: true`) виден только в `astro dev`: в сборке его нет ни в списках, ни
по URL.

## Шаг 4: выпуск

```bash
/seo-audit            # build + seo:check + HTTP-набор + curl по домену
/release              # аудит зависимостей, образ, приёмка (pnpm accept:image), тег, пуш, handoff в <org>/infra
```

Сайт живёт за Traefik в `<org>/infra`; что ему нужно от прокси (rate-limit на форму,
`X-Forwarded-Proto`, закрытый staging) — `docs/reference/deployment.md`.

## Гейт перед push

```bash
pnpm check    # gate — состав: .claude/rules/tests-pipeline.md § Gate
```

Его же гоняет pre-push — для пушимого HEAD на чистом дереве; `test:http` — HTTP-набор на
prod-сервере из этой сборки.
Браузерный набор (`pnpm test:e2e`) — обязательный шаг `/release`: тянет браузер.

## Когда что-то идёт не так

- **`/smartdev`** — покажет состояние и подскажет следующий шаг
- **Артефакты не stable** → стек `/stack-deep-dive` здесь; FSD-карта `/fsd-deep-dive` в
  `<org>/strategy`
- **Reference-набор мешает** → он удаляется `/de-template` (режимы — его `references/prune.md`)
- **Страница не в выдаче** → `/seo-audit`
