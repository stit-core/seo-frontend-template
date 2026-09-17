# Решения владельца по `ssr-frontend-template` v1

Дата: 2026-09-17. Зафиксировано в сессии сборки по `NEXT-SESSION.md` §3; рекомендации
ресёрча — `00-synthesis.md` §10. Критерий выбора владельца: **красивый, удобный, приятный
шаблон без замудрённостей, сделанный грамотно — по правилам, стандартам и трендам**; всё,
что не обязательно контент-сайту в поиске, — опция или отсутствует.

Не пересматриваются (синтез §2): Astro 7.3 + `@astrojs/node` (`output: 'static'`,
`standalone`), имя `ssr-frontend-template`, форк `<org>/site` / `SVC=site`, отдельный
репозиторий с родством по обвязке, хостинг одним Node-образом за Traefik/CrowdSec,
наследие обвязки/FSD/гейта, SEO-канон MUST, git-контент по умолчанию.

| # | вопрос | решение | следствия для реализации |
|---|---|---|---|
| 1 | Шрифты | Системный стек (`system-ui`), веб-шрифта нет | `--font-sans` из токен-слоя SPA; Astro Fonts API не подключается; в `styling.md` — опция одной строкой: один variable-шрифт (Wix Madefor Text, `subsets: ['cyrillic','latin']`, `weights: ['400 800']`) |
| 2 | Абсолютные URL при prerender | **Вариант C**: `site: 'https://__site_origin__'` на сборке + штамповка `SITE_URL` в `docker/entrypoint.sh` | штампуются `*.html\|*.xml\|*.txt\|*.mjs` в `dist/` (включая `dist/server/chunks`); e2e «в ответе нет `__site_origin__`»; HTML не предсжимается |
| 3 | Режим рендера v1 | **Только static** (prerender) + on-demand для `robots.txt`, `sitemap.xml`, `rss.xml`, `healthz`, `now`, `api/*` (форма) | Вариант D (`memoryCache` + `routeRules` + single-flight + прогрев + `/internal/*`) — только рецепт в `rendering.md`, кода нет; `cache`/`routeRules` в `astro.config.ts` не задаются |
| 4 | Пресеты | Механики пресетов нет; один reference-набор контент-сайта | поля `preset` в `service.md` нет; лендинг = prune лишних слайсов через `/de-template`; пресет `docs` — при появлении потребителя |
| 5 | i18n в reference-наборе | ru + en | физический `src/pages/en/**`, `translationKey`, свой hreflang-хелпер (runtime origin); en-контент минимальный, непереведённое — 404 |
| 6 | Форма обратной связи | honeypot + time-trap + origin-check без JS; **один канал** `FORM_DELIVERY=backend\|smtp` с ретраями; PRG 303 на `/contacts/spasibo` (`noindex`) | durable-спул на диске и ≥ 2 канала — SHOULD в `api.md`, не код; Telegram-канала в v1 нет |
| 7 | Капча / аналитика / cookie-баннер | `CAPTCHA_PROVIDER=none`; `ANALYTICS=metrika\|none`, Метрика грузится после idle; cookie-баннер — опция, выключен | шов `CaptchaVerifier` без реализаций провайдеров; включение баннера описано в `analytics.md` |
| 8 | OG-изображения | Статическая обложка поста или дефолт сайта 1200×630 | генератора satori+resvg нет; `og:image` абсолютный после штамповки |
| 9 | Кабинет / auth | **Нет и не планируется** в этом шаблоне: только статика; приложение — `spa-frontend-template` | режима `client` в reference-наборе нет, нет `ENABLE_ACCOUNT`, нет BFF-рецепта; в доке — триггер R-4 и ссылка на SPA-шаблон |
| 10 | Форматирование `.astro` | Prettier + `prettier-plugin-astro` **только для `*.astro`**; остальное — Biome | Biome линтит `.astro` (флаг `html.experimentalFullSupportEnabled`), но его форматтер для `*.astro` выключен override'ом; Prettier ограничен `*.astro`; `format:check` гоняет оба |
| 11 | Состав `docs/stack` | **12 kinds**: `service, runtime, content, routing, rendering, seo, styling, observability, config, dependencies` обязательные + `api`, `analytics` условные | kind `images` не заводится — пайплайн картинок описывает секция `content.md`; порядок волн `service → runtime → content → routing → rendering → seo → styling → api → analytics → observability → config → dependencies` |
| 12 | Негативные фикстуры гейта | **Да**: `.gate-fixtures/` + шаг «линтер обязан упасть» внутри `pnpm check` | фикстуры: cross-slice, импорт вверх, deep-import в `.astro`-цель, клиентский `<script>` с нарушением, `<img>` без `alt` (пустой a11y-конфиг), server-only в `index.ts` |
| 13 | Репозиторий | Создан владельцем на Gitea пустым: `git@git.stit.tech:stit-core/ssr-frontend-template.git`; клон `~/git/stit-core/ssr-frontend-template`; seed = дерево `spa-frontend-template@0516b94` первым коммитом | Fable-агенты работают только в этом каталоге; соседние репо `~/git/stit-core/*` — read-only |
| 14 | `docs/research/` | Живёт в этом репо (`docs/research/ssr/`), закоммичен; в SPA-репо не хранится | пути в build-brief — абсолютные от этого репо |
| 15 | Git-политика | Коммит + push в `main` после каждой принятой фазы делает главная сессия; агенты не коммитят | Conventional Commits, без `--no-verify`; `lefthook pre-push → pnpm check` |
| 16 | Infra-PR (`project-infra-template-compose`) | После фаз 1–4, отдельным Fable-агентом в репо infra (фаза 7) | первый деплой без него невозможен, разработка не блокируется; спецификация — `04-runtime-deploy.md` §3.4–3.9, синтез §8 |
| 17 | SPA-репо | `roadmap.md` правится (указатель на этот репо и follow-up'ы), коммитит владелец | — |

## Производные решения сессии (в рамках ответов выше)

| тема | решение | основание |
|---|---|---|
| Острова | Без фреймворка островов: vanilla `<script>` в `.astro`; `@astrojs/react`/Preact не подключаются | синтез §10 п. 5; кабинета нет ⇒ реюз React-кода SPA не нужен |
| Sitemap/RSS | Свои `pages/{sitemap.xml,rss.xml,robots.txt}.ts` на runtime `SITE_URL`; `@astrojs/sitemap` не подключается; `@astrojs/rss` допустим | 08 §7.17, синтез §5.1 |
| On-demand HTML | Единственная on-demand HTML-страница reference-набора — `now` (образец режима `dynamic`) | NEXT-SESSION §4 фаза 5 |
| Поиск, каталог | В v1 нет (`search`, `catalog/*` из §6.6 не разворачиваются) | NEXT-SESSION §4 фаза 5 |
| Observability | JSON-логгер запросов на on-demand роутах + `/healthz`; Sentry server-side (`@sentry/node`) только при `SENTRY_DSN` через dynamic import; клиентского RUM нет (0 JS) | синтез §8, 12 §8 |
| Тема | Переключатель темы — единственный остров v1: cookie `scheme` + `data-scheme` на `<html>` в первом байте, без FOUC | синтез §9.2, 13 §2.2 п. 4 |
| Правила `.claude/rules` | Каждая фаза пишет правила своих инвариантов (фаза 1 — переписанные `fsd-architecture`/`env-local`/`tests-pipeline`/`shared-ui`; 2 — `content-invariants`; 3 — `render-safety`; 4 — `seo-invariants`); фаза 6 их только сверяет | агенты фаз 2–5 не должны работать по правилам SPA-стека |
| 404 | `pages/404.astro` — on-demand (`prerender = false`): prerendered 404 адаптер отдаёт с диска до middleware, и редиректы из `redirects.yaml` на незнакомые пути не срабатывали бы; 404 получает `X-Request-Id`, JSON-лог и `X-Robots-Tag` | 08 §7.4; Astro `core/routing/handler.js` |
| Черновики | `draft: true` виден только в `astro dev` (с пометкой); в сборке — ни в списках, ни по URL; HMAC-preview (C-5) в v1 нет — статика без on-demand рендера контента | «без замудрённостей» |
| Язык записи | По каталогу `content/{ru,en}/`; поля `lang` во frontmatter нет (один источник истины) | 14 §2.9.1 |
| Редиректы | `content/redirects.yaml` парсится на сборке (`js-yaml` — тот же парсер, которым Astro читает frontmatter; Vite-плагин в `astro.config.ts`), в серверный бандл попадает JSON; скрипты гейта читают YAML тем же пакетом | второй парсер YAML в коде не нужен |
| Штамповка и контент | Литерал плейсхолдера origin запрещён в текстах контента (`check:content`): штамповка переписала бы его в HTML | 08 §5 |
