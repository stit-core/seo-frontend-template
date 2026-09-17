# Промпт для следующей сессии: сборка `ssr-frontend-template`, фазы 6–7

> Как использовать: открыть Claude Code в `/home/mm/git/stit-core/ssr-frontend-template` и
> написать одной строкой: «Прочитай `docs/research/NEXT-SESSION.md` целиком и действуй по нему».

## 0. Роль и режим работы

Ты — главная (оркестрирующая) сессия. Ресёрч закрыт, решения владельца зафиксированы,
спецификация написана. Твоя работа — **вести фазы по одной**: запустить Fable-агента на фазу,
принять результат (гейт, e2e, образ, ревью), закоммитить и запушить, отметить roadmap, запустить
следующую фазу. Сама сессия код не пишет и большие файлы не читает без нужды: **контекст сессии —
ограниченный ресурс, всё, что можно делегировать агенту, делегируется** (владелец прямо просил
беречь контекст). Отчёты агентов — компактные (≤ 60–80 строк).

Принцип владельца, дословно, обязателен в каждом промпте агента: **красивый, удобный, приятный
шаблон без замудрённостей, сделанный грамотно — по правилам, стандартам и трендам**; если фича не
обязательна для контент-сайта в поиске — она опция или её нет. Из этой сессии: на вопросы «как
сделать» владелец отвечал «давай сразу грамотно» — выбирать стандартное решение без машинерии
без потребителя.

## 1. Где что (все пути — от корня этого репо)

| что | путь |
|---|---|
| Спецификация всех фаз (объём, гейты, версии, инварианты, формат отчёта, приёмка) | `docs/research/BUILD-BRIEF.md` — **§5 «Фаза N»** для промпта агента, §8 для приёмки |
| Решения владельца + производные решения сессий (404 on-demand, черновики только в `astro dev`, YAML на сборке, запрет плейсхолдера в контенте…) | `docs/research/ssr/DECISIONS.md` |
| План с отметками фаз | `.claude/plans/roadmap.md` (Active → «Сборка v1 по build-brief») |
| Отчёты принятых фаз (раздел «Данные для следующей фазы» — вход промпта) | `docs/research/reports/phase-N.md` |
| Скрипт docker-приёмки (сборка образа, curl, штамповка, дренаж, staging) | `docs/research/reports/accept-image.sh` (`bash …`; переменная `PORT`, дефолт 3212) |
| Ресёрч (спецификации для агентов: точные разделы названы в brief §3) | `docs/research/ssr/**` (синтез — `00-synthesis.md`; spike Astro — `round2/08-spike-astro.md`; tooling — `round2/12-tooling-fsd.md`; контент — `round2/14-content-architecture.md`; SEO — `02-seo-canon.md`; деплой — `04-runtime-deploy.md`; обвязка — `round2/13-template-v2.md`) |
| Текущее состояние кода | `CLAUDE.md` (стек, команды, инварианты), `.claude/rules/*.md`, `docs/reference/{deployment,rendering,kinship}.md`, `README.md` |

Состояние по фазам — `git log --oneline` (один коммит на фазу, Conventional Commits) и отметки
`[x]` в roadmap. Если `git status` не пуст — это незавершённая работа агента предыдущей сессии:
прочитать отчёт/`git diff --stat`, прогнать гейт и решить — принять или доделать агентом.

Соседний `spa-frontend-template`: там незакоммиченная правка `.claude/plans/roadmap.md`
(указатель на этот репо и follow-up'ы) — владелец решил коммитить её сам.

## 2. Цикл одной фазы (повторять для 6 → 7)

1. **Промпт агента** = brief §5 «Фаза N» (дословно объём, гейт, «не делать») + принципы и
   решения владельца (дословно) + «Контекст предыдущих фаз» (раздел 6 отчёта `reports/phase-(N-1).md`)
   + блок правил (§3 ниже) + формат отчёта (brief §7, ≤ 70 строк). Запуск: `Agent`,
   `subagent_type: general-purpose`, `model: "fable"`, в фоне. Не больше 2–3 агентов одновременно.
2. **Приёмка** (сама сессия, командами, не по словам агента):
   `pnpm check` и `pnpm test:e2e` (оба зелёные, после e2e нет процессов `docker/server.mjs`/`astro dev`);
   `bash docs/research/reports/accept-image.sh` (образ, `/`, `/en`, `/xx` 404, `/healthz`, штамповка
   `dist/client` = 0 остатков, staging `X-Robots-Tag`, `docker stop` < 1 с) + curl по новым роутам
   фазы; `pnpm kin:diff`; для фаз ≥ 4 — `pnpm seo:check`; для фазы 5 — открыть сайт в Browser
   pane (light/dark, мобильный вьюпорт, форма, 404) — «шаблонно-серое» возвращать агенту.
3. **Ревью диффа** — три read-only агента (`model: opus`) параллельно, каждый ≤ 10 находок с
   `file/line/summary/failure_scenario`: (a) корректность построчно + ловушки Astro/Node/sh,
   (b) соответствие brief §5 + изменённое поведение + консистентность доков/правил с кодом,
   (c) упрощение/reuse/эффективность/altitude (с оглядкой на «без замудрённостей»). Затем один
   Fable-агент исправлений со сводным списком (с формулировкой «что и почему», отклонения
   обосновать), с обязательным перепрогоном гейта/e2e/docker. Так в этой сессии в фазе 1 нашлось
   15 дефектов уровня рантайма/деплоя при зелёном гейте, в фазе 2 — 10.
4. **Коммит + push** делает сессия: `git add -A && git commit` (`feat(scope): …`, тело — что
   добавлено, trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`), `git push origin
   main` (pre-push гоняет `pnpm check`). Отметить `[x]` в roadmap (можно тем же коммитом).
   Отчёт агента фазы сохранить в `docs/research/reports/phase-N.md` (`cp` из scratchpad).
5. Записать в `DECISIONS.md` (таблица производных решений) всё, что решено в ходе фазы и не
   покрыто владельцем; уточнить brief, если формулировка фазы разошлась с реальностью.

## 3. Блок правил для каждого промпта агента (вставлять дословно)

- Работать только в `/home/mm/git/stit-core/ssr-frontend-template`; соседние репо
  `/home/mm/git/stit-core/*` — read-only; временные файлы — в scratchpad сессии (путь передать).
- **Не коммитить, не пушить, не трогать git-историю**: никаких `git commit/push/reset --hard/
  checkout -- ./clean/stash`, никакого `--no-verify`. `.claude/plans/roadmap.md`,
  `docs/research/**`, `.claude/skills/**`, `docs/stack/**` не редактировать (кроме фазы 6, где
  скиллы и `docs/stack` — её объём).
- Forward-only (без «было/стало», changelog'ов, переходных пометок), комментарии только WHY и
  по-русски, идентификаторы латиницей; каждая зависимость и опция — строка обоснования в отчёте;
  версии точные (без кареток); запрещённые пакеты — brief §4.6; объём фазы не расширять.
- Гейт перед claim «готово»: `pnpm check` и `pnpm test:e2e` зелёные, фоновых процессов нет
  (`astro dev` в Astro 7 — демон: `pnpm astro dev stop`).
- Если Bash отклоняет запись файла heredoc'ом — писать через Write/Edit. При 403/429 API — дождаться
  и продолжить с места остановки (`git status`), не начинать заново.

## 4. Что уже известно про среду и агентов (из этой сессии)

- **403 «authentication_failed» от API** (Fable и Opus) случается несколько раз в день. Агент
  умирает с `status: failed` — возобновлять `SendMessage(to: <agentId>, "Продолжай с места
  остановки…")`; его дерево сохраняется. Если агент числится `running`, но 30+ минут не пишет файлы
  и нет процессов гейта — он завис: `TaskStop` и запустить агента приёмки/доводки на текущем дереве
  (так закрыта фаза 1).
- Агенты иногда кладут артефакты в scratchpad `phase-N/` (логи, `*.bak`) — `.gitignore` их не
  касается, репо чист; проверять `git status` перед коммитом.
- e2e (`pnpm test:e2e`) собирает `dist` заново и штампует его на месте — после e2e `pnpm size`
  меряет уже проштампованный `dist`; `pnpm check` пересобирает.
- Docker Hub бывает недоступен (таймаут `auth.docker.io`) — повторить сборку; образ `ssr-template-accept`
  локально уже есть.
- Скиллы `/init-service`, `/de-template`, `/scaffold`, `/stack-deep-dive`, `/release`, `/smartdev`
  в этом репо до фазы 6 остаются SPA-версиями — на них не опираться.
- Ревью фазы 4 (три агента) дало 25 находок при зелёном гейте, принято 15; вход фазы 5 —
  `reports/phase-4.md` §6 (пропсы `DocumentLayout`, крошки + `jsonLd` из одного массива,
  `getPublicConfig()` для публичных ключей, e2e «в `<body>` ни одного `<script>`» — остров темы
  потребует явного исключения в `seo.spec.ts`/`rendering.spec.ts` + строки в `.size-limit.cjs`).

## 5. Заметки к оставшимся фазам (сверх brief)

- **Фаза 4 (SEO)**: `robots.txt`/`sitemap.xml`/`rss.xml` — on-demand с runtime `SITE_URL`; sitemap
  исключает черновики и `from` из `redirects.yaml` (`@/shared/redirects`), `lastmod` только из
  `updatedDate`; hreflang — из `findTranslation` (`@/entities/post`), только для существующих
  переводов; `seo:check` по `dist/client` — уникальность `title`/`description` всех страниц (C-3);
  JSON-LD без `FAQPage`/`HowTo`/`SearchAction`; `<meta name="robots">` на prerendered не зависит от
  env (build-time); `e2e/seo.spec.ts` — через `request` (сырой HTML), включая `-A Googlebot`.
  Проверить чек-лист 02 §4 при приёмке. Реестр маршрутов — `scripts/lib/routes.mjs` (`pageRoutes()`).
- **Фаза 5 (reference-слайсы, «красиво»)**: перед вёрсткой агент загружает skill
  `frontend-design:frontend-design`; тема — единственный остров (инлайн-скрипт ≤ 300 Б + cookie/
  `localStorage`, CSS `light-dark()` уже в токен-слое, `[data-scheme]` переключает); форма —
  `FORM_DELIVERY=smtp|backend` (один канал, ретраи, `nodemailer` только для smtp), PRG 303, тело
  заявки не логировать; `legal/privacy` с плейсхолдерами `{{OPERATOR_*}}`; `og-default.png`;
  картинки — `<Picture>` build-time (обложки уже в `entities/post/content/covers`); `og-default.png`
  сейчас плейсхолдер из токен-слоя — нужен дизайн 1200×630; приёмка — визуально в браузере обязательна.
- **Фаза 6 (обвязка)**: 12 kinds (DECISIONS #11), `/de-template` обязан падать на плейсхолдерах
  оператора в политике ПДн и чистить reference-набор по prune-листу из отчёта фазы 5;
  гейт фазы — прогон `/init-service` → `/de-template` на тест-форке и `/scaffold page`.
- **Фаза 7**: в этом репо — только in-repo часть (`ecosystem.md`, sweep «6 → 7», handoff-документ
  для infra); соседние репо для агентов read-only — их правки владелец ведёт отдельными
  сессиями по порядку синтеза §9.5. Для handoff: в
  `project-infra-template-compose` — `compose/site.yml` без `read_only: true` для `site`
  (штамповка пишет в `/app/dist/client`), `stop_grace_period` ≥ `SHUTDOWN_TIMEOUT_MS` + запас,
  `/index.html` → `redirectRegex`, `secure-headers` владеет security-заголовками, Traefik
  `basicAuth` + `X-Robots-Tag` на staging; дефекты infra из синтеза §8.

## 6. Финал сессии

Когда фазы 1–6 приняты: обновить README/`CLAUDE.md` (фаза 6 это делает), удалить этот файл и
`docs/research/reports/accept-image.sh` только если их заменили скилл `/release` и доки;
roadmap — секцию плана удалить целиком (forward-only), follow-up'ы — строкой в Backlog.
