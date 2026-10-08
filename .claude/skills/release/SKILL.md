---
name: release
description: Выпустить новую версию сайта — собрать Node-образ, принять его локально (pnpm accept:image), запушить в registry под тегом vX.Y.Z и напечатать handoff для <org>/infra (make bump SVC=site). Применяй, когда юзер просит выпустить или запушить новую версию сайта. Выкатка тега на VPS — не здесь, а в <org>/infra.
---

# Skill: release

Канонический релиз сайта. **Зона ответственности этого репо: код → образ в registry.
На этом STOP.** Дальше — handoff в `<org>/infra`: rollout выполняется там
(`make bump SVC=site TAG=vX.Y.Z` — правит `SITE_TAG` в `.env` VPS + force-recreate).
Деплой-команды чужих репо отсюда не запускаются.

**Один образ на все среды.** Сборка печёт плейсхолдер origin, контейнер штампует
`SITE_URL` при старте — образ для staging и prod один и тот же, отличается только env
(`docs/reference/deployment.md`). Registry-путь и `infra-svc` — из
`docs/stack/service.md § Идентичность`.

## Когда применять

- «Релизим v1.2.3» / «запушь новую версию» / «/release»
- После закрытой задачи и зелёного `pnpm check`, когда юзер сказал «пора катить»

## Когда НЕ применять

- «Собери образ локально посмотреть» → `docker build -f docker/Dockerfile -t site-local .`
- Релиз не из `main` — СТОП (чек-лист pre-flight ниже)
- Юзер не сказал OK на релиз → СТОП, спроси

## Pre-flight

- [ ] Юзер явно сказал OK (тег и пуш видны вне репо)
- [ ] Ветка `main`, рабочее дерево чистое
- [ ] `pnpm check` зелёный (внутри — HTTP-набор на prod-сервере). Нет — СТОП, чинить
- [ ] Версия названа юзером (semver по уровню изменений) — не угадывай
- [ ] Оператор залогинен в registry (`docker login <host>` — вне процесса, не делай сам)
- [ ] Чек-листы ниже пройдены

## Шаги

1. **Браузерный набор** — обязателен, в гейт не входит (тянет браузер):

   ```bash
   pnpm test:e2e
   ```

   Сборка и Playwright на prod-сервере как в контейнере, порты свободные: axe (WCAG 2.2 AA) в
   обеих темах на каждой странице сборки (`<путь>/index.html`), 404, `/now` и ответе формы с
   ошибками; выбор темы; форма без JavaScript в настоящем браузере. Красный — релиз не едет.

2. **Аудит прод-зависимостей** — известные уязвимости того, что едет в образ:

   ```bash
   pnpm audit --prod --audit-level=high
   ```

   Код ≠ 0 — релиз не едет. Исправленная версия есть — обновление по
   `docs/stack/dependencies.md § Обновления` и шаги заново; исправления нет — решение строкой
   `auditConfig.ignoreGhsas` в `pnpm-workspace.yaml` с причиной: почему уязвимость в этом сайте не
   эксплуатируется. Нужна сеть — реестр отвечает за базу уязвимостей.

3. **Сборка образа**

   ```bash
   docker build -f docker/Dockerfile --secret id=npmrc,src="$HOME/.npmrc" \
     -t <registry>/<org>/site:vX.Y.Z .
   ```

   `-f docker/Dockerfile` обязателен — Dockerfile лежит не в корне. `--secret id=npmrc`
   отдаёт `pnpm install` в образе `~/.npmrc` оператора; Dockerfile монтирует его
   необязательно, а buildx падает на отсутствующем файле — без `~/.npmrc` флаг убирают.

4. **Приёмка образа**

   ```bash
   pnpm accept:image <registry>/<org>/site:vX.Y.Z
   ```

   Скрипт проверяет: отказ без `SITE_URL` за 20 с (код ≠ 0, лог называет ключ), штамповку origin
   (в `dist/client` не осталось плейсхолдера), статусы ключевых маршрутов и 404, canonical на
   runtime origin, CSP, открытый `robots.txt`, проштампованные `sitemap.xml` (все адреса на
   runtime origin) и фиды, одну форму адреса (301 со слеша, `//` и `/index.html`, 404 на `%2F`),
   отказ вместо падения
   (`TRACE` — 400, `/healthz` после него — 200), контур staging (`ROBOTS_POLICY=noindex`:
   `Disallow: /` и `X-Robots-Tag`), дренаж: `SIGTERM` доходит до node, выход 0 быстрее
   `SHUTDOWN_TIMEOUT_MS`. Красный — релиз не едет. Для глаз печатает заголовки и медиану TTFB —
   их порогов в скрипте нет.

5. **Тег**: `git tag vX.Y.Z && git push origin vX.Y.Z` (по явному OK).

6. **Пуш образа**: `docker push <registry>/<org>/site:vX.Y.Z`.

7. **INFRA-HANDOFF** — напечатать блок:

   ```
   === INFRA HANDOFF · <org>/site vX.Y.Z ===
   WHAT:   новый образ <registry>/<org>/site:vX.Y.Z
   ACTION: в <org>/infra: make bump SVC=site TAG=vX.Y.Z
   ENV:    <новые ключи из docs/stack/config.md; иначе "—">
   AI-BOTS: <AI_BOTS_POLICY из src/shared/config/site.ts>, реестр <первые 12 знаков CRAWLERS_SHA256 из scripts/lib/site-policy.mjs>
   PROXY:  <новые требования к Traefik: rate-limit, редиректы; иначе "—">
   RISK:   <риски отката и совместимости; иначе "—">
   ===
   ```

   Новые env-ключи инфра-админ дописывает в `.env` VPS **до** бампа, иначе контейнер
   поднимется с дефолтами или не поднимется вовсе (`SITE_URL` обязателен). Политика ИИ-ботов —
   поле сборки, она уже в образе: строка `AI-BOTS` говорит инфре, что политика или версия реестра
   ботов сменилась и список источников allowlist CrowdSec пора обновить
   (`docs/reference/infra-handoff.md § 1.5`).

8. **После выката** — прогнать `/seo-audit` по прод-домену и пройти пункты «после
   деплоя» чек-листа ниже.

## SEO-чек-лист релиза

Перед сборкой:

1. `pnpm check` зелёный (внутри — `seo:check` по `dist/client` и HTTP-набор: сырой HTML, в т.ч.
   под Googlebot и UA ботов реестра, robots и staging, sitemap, фиды)
2. `pnpm test:e2e` зелёный (шаг 1: axe в обеих темах)
3. Дифф `robots.txt` и `sitemap.xml` против прошлого релиза просмотрен глазами
4. Бюджеты `pnpm size` не превышены

После деплоя (curl по прод-домену):

5. `curl -sI https://<domain>/` → 200, нет `X-Robots-Tag: noindex`
6. `curl -s https://<domain>/robots.txt` → группа `*` — `Allow: /`, **не** `Disallow: /`; именная
   группа ИИ-ботов — по политике сайта (`AI_BOTS_POLICY`), абсолютный `Sitemap:`
7. `curl -s https://<domain>/sitemap.xml | grep -c '<loc>'` → ожидаемое число, все URL на
   прод-домене и по https
8. `curl -sI https://<domain>/net-takogo` → **404**, не 200 и не редирект на главную
9. `curl -sI http://<domain>/` и `https://www.<domain>/` и `https://<domain>/about/` →
   ровно один 301/308 на канонический вид; `https://<domain>/about/index.html` — тоже один 301,
   а старый адрес из `redirects.yaml` со слешем ведёт сразу на цель
10. Исходник главной и одной контентной страницы глазами: `<title>`, `description`,
    `canonical`, hreflang (взаимный), `og:*`, JSON-LD, `<html lang>`, ровно один `<h1>`
11. Rich Results Test (`search.google.com/test/rich-results`) — без ошибок
12. Schema Markup Validator (`validator.schema.org`) — без ошибок
13. Валидатор микроразметки Яндекса (`webmaster.yandex.ru/site/tools/microtest/`)
14. PageSpeed Insights (mobile) по 2–3 ключевым URL — CWV в «good»

Один раз на проект (действия оператора, не скилла):

15. Google Search Console: домен подтверждён, sitemap подан, отчёт «Индексирование
    страниц» без критики
16. Яндекс Вебмастер: сайт подтверждён, sitemap подан, **JS-рендеринг выключен**,
    региональность задана, привязка к Метрике
17. IndexNow: файл `https://<domain>/<ключ>.txt` доступен, тестовый submit вернул 200/202

## Юридический чек-лист релиза

Проверяется, когда на сайте есть форма (то есть почти всегда):

- [ ] `/legal/privacy` открывается и **не содержит** `{{OPERATOR_` — проверить
      `grep -rn '{{OPERATOR_' src/`
- [ ] Реквизиты оператора в политике совпадают с реальными (название, ИНН, адрес, почта)
- [ ] `PRIVACY_POLICY_VERSION` в `src/shared/config/site.ts` соответствует текущей
      редакции текста; текст менялся — версия поднята, иначе доказательство согласия
      ссылается не на ту редакцию
- [ ] Форма отправляется только с отмеченным согласием, и галочка не предустановлена;
      рядом — ссылка на политику
- [ ] Заявки уезжают в канал, который хранит их в РФ; тело заявки не пишется в лог
- [ ] Уведомление в РКН о намерении обрабатывать ПДн подано (разово, вне репо)
- [ ] Rate-limit на публичный POST формы стоит на прокси — иначе форму наружу не открывают

## Что НЕ делать

- ❌ Деплой-команды чужих репо (`make bump`, `make ship`, ssh) отсюда — зона `<org>/infra`
- ❌ Теги `:latest`/`:edge` — только `vX.Y.Z`
- ❌ Тег без зелёных `pnpm check` и `pnpm test:e2e`, с грязным деревом, с high в `pnpm audit --prod`
  без решения или с красной приёмкой образа
- ❌ Собирать образ с `SITE_URL` в build-arg — образ перестаёт быть переносимым
