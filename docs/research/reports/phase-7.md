# Фаза 7 (in-repo) — отчёт

## 1. Сделано
- **`docs/reference/infra-handoff.md`** (новый, ~480 строк) — самодостаточное задание для соседних репо:
  - «Сервис `site` одним экраном» (образ, static-first, штамповка origin, публичный POST формы, лог, дренаж) + порядок 4 сессий;
  - **`project-infra-template-compose`**: готовый `compose/site.yml` с контрактом каждого поля (без `read_only`, `init`, `stop_grace_period: 20s` ↔ `SHUTDOWN_TIMEOUT_MS`, `mem_limit: 512m` ↔ `--max-old-space-size=384`, `networks`, оба healthcheck'а, запрет `user:`/`logging:`), таблица `.env` VPS → env контейнера, три роутера (`site`, `site-form` на `POST /api/contact`, `site-www`), дельта `middlewares.yml.tpl` (`compress` br+gzip, `www-to-apex`, `strip-index-html`, `form-rate-limit`, `form-body-limit` 64 КиБ, `retry`, `staging-auth`/`staging-noindex`, снятие `sslRedirect`), `accessLog.filePath` + `X-Request-Id: keep` + снятие фильтра статусов, CrowdSec (acquisition A/B, `rdns` + `seo-bots-whitelist`, локальный rDNS-whitelist, AI-краулеры как продуктовое решение), таблица 13 остальных файлов (`.env.example`, `Makefile bump --wait`, `ROLE_FILES[edge]`, `preflight-dns` + `www`, `smoke.d/90-site.sh`, landing, 2 правила, 3 дока, 2 скилла), приёмка первого деплоя (10 шагов с curl по канону §5 п. 5–9/15–18 + `/seo-audit`);
  - `corp-infra-template` / `spa-frontend-template` / `stit-public` — по абзацу с точными файлами и откуда брать текст.
- **`docs/reference/ecosystem.md`** — строка контракта `infra-handoff.md`; абзац операционной модели теперь ссылается на него, а не пересказывает требования.
- **`docs/reference/deployment.md`** — ссылка на handoff в чек-листе оператора; **исправлено** `sourceCriterion.ipStrategy.depth: 1` у rate-limit формы (см. §4).
- **`docs/README.md`**, **`README.md`**, **`CLAUDE.md`** — строка про `infra-handoff.md` в картах.

## 2. Проверено
- `pnpm check` — **exit 0**: typecheck/lint/format чисто; vitest 35 файлов / 162 теста; steiger «No problems»; `check:gate` все нарушения пойманы; `check:content` 12 записей / 2 редиректа / 5 ссылок; build; `check:links` 35 страниц / 802 ссылки; `seo:check` 34 страницы (hreflang 22, пар 11); size 4.24 / 4.39 / 3.82 / 4.37 kB.
- `pnpm kin:diff` — **«корзина „идентично“ совпадает»**, exit 0. `check:links`/`check:content` читают только `dist/client` и `src/**/content`, Biome/Prettier `.md` не трогают — новый документ гейт не задевает.
- Фоновых процессов этой сессии нет, порты 3000/3201/3202/3299/4321 свободны (живой `chrome-headless-shell` — процесс вне этой сессии).

## 3. Sweep «6 → 7»
| найдено | решение |
|---|---|
| `spa-frontend-template` — `kinship.md`, `scripts/kin-diff.mjs`, `docs/README.md`, `README.md` ×2, `ecosystem.md` ×3, `rendering.md`, `getting-started.md`, `docs/stack/_templates/rendering.md` | оставлено: это родство (`kin:diff`) и граница ролей «сайт vs приложение за логином» — легитимные упоминания |
| `nginx` — `docker/server.mjs:55` («Traefik/nginx держат idle-соединение дольше…») | оставлено: утверждение верное и общее про обратные прокси, не след SPA-обвязки; `docker/*` — зона «сначала спросить» |
| `VITE_` — `CLAUDE.md:184`, `env-local.md:11,61`, `render-safety.md:26` | оставлено: это запреты-инварианты, а не использование |
| `MSW` — `.claude/rules/comments.md:39` (пример «Good») | оставлено: файл в корзине «идентично» с SPA-шаблоном — правка уронила бы `kin:diff` |
| `@stit/ui`, `TanStack`, `React`, `ENABLE_ACCOUNT`, `msw`, `zustand`, `preact` | не найдено; `@astrojs/react` (`CLAUDE.md:98`, `dependencies.md:45`) и `vitest-browser-astro` (`tests-pipeline.md:63`) — запреты-инварианты, оставлены |
| `TODO`/`FIXME`, «пока что», «позже», «временно», «в следующей», «фаза» вне `docs/research/**` | не найдено; совпадения на «пока» — это союз «пока/пока не» в живых формулировках и UI-строке «Записей пока нет» |

## 4. Требует решения владельца
- **Правка `deployment.md` (сделана, стоит подтвердить)**: у rate-limit формы был `sourceCriterion.ipStrategy.depth: 1`. Traefik стоит на границе, `X-Forwarded-For` приходит от клиента и никем не подписан — глубина делает лимит обходимым подделкой заголовка. Теперь `sourceCriterion` не задаётся (дефолт — адрес клиента); тот же текст в handoff.
- В handoff вынесены 5 развилок: источник CrowdSec acquisition (файл vs docker-сокет), включение staging-контура (`SITE_EDGE_EXTRA_MW` vs отдельный оверрайд), судьба заглушки на корне (прунить vs переименовать в `placeholder`), `@stit/ui` в карте экосистемы, профиль памяти (512 МБ vs 768 МБ).
- Follow-up вне моей зоны: `/de-template` (`A.10`) про `infra-handoff.md` молчит — в форке раздел 1 нужен (это задание его инфре), разделы 2–4 стоит прунить; в документе такая строка есть, в скилле нет.

## 5. `git status --short`
```
 M .claude/plans/roadmap.md      ← не моё (главная сессия: Backlog уже ссылается на infra-handoff.md)
 M CLAUDE.md
 M README.md
 M docs/README.md
 M docs/reference/deployment.md
 M docs/reference/ecosystem.md
D  docs/research/NEXT-SESSION.md          ← не моё (удаление главной сессии, staged)
D  docs/research/reports/accept-image.sh  ← не моё (то же)
 M docs/research/ssr/DECISIONS.md ← не моё (снятие ссылок на NEXT-SESSION.md)
?? docs/reference/infra-handoff.md
```
Git не трогал: ни коммитов, ни `--no-verify`, соседние репо read-only.
