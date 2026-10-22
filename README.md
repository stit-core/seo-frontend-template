<div align="center">

# ssr-frontend-template

### Шаблон индексируемого сайта: static-first, SSR по необходимости

Astro 7 + Node-адаптер, Feature-Sliced Design под линтером, JavaScript — только
острова по реестру, один Docker-образ на все среды. Приложение за логином —
это [`spa-frontend-template`](https://git.stit.tech/stit-core/spa-frontend-template).

[![License](https://img.shields.io/badge/license-Apache--2.0-2563eb)](LICENSE)
[![Часть stit](https://img.shields.io/badge/stit-открытые_шаблоны-6366f1)](https://git.stit.tech/stit-core/stit-public)
[![Astro](https://img.shields.io/badge/Astro-7-ff5d01)](#стек)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](#стек)
[![Arch](https://img.shields.io/badge/arch-FSD_%2B_ESLint_%2B_Steiger-22c55e)](#структура)

</div>

---

## Стек

Astro 7.3 + `@astrojs/node` (`output: 'static'`, standalone) · TypeScript 6
(`astro/tsconfigs/strictest`) · Tailwind v4 на собственном токен-слое · страница — блоки каталога
strategy по её плану, тексты — copy deck, контакты — факты (данные `strategy/`) · записи — Markdown
в git внутри слайса (Content Layer + Zod 4) · локали 1…N одним дескриптором (у шаблона `ru` без
префикса + `en` с префиксом) ·
редиректы как данные (`content/redirects.yaml`) · SEO-слой `shared/seo` (canonical, hreflang,
OG, JSON-LD; `robots.txt` on-demand на runtime origin, `sitemap.xml` и `rss.xml` — файлы сборки) · Biome 2 +
Prettier (только `*.astro`) ·
ESLint 10 (`eslint-plugin-astro`, `boundaries`) + Steiger · Vitest 5 (Container API) +
Playwright · size-limit · pnpm 10 · lefthook + commitlint.

## Быстрый старт

```bash
# Node 24 (.nvmrc) + pnpm 10: точную версию проекта (packageManager) pnpm подтянет сам
nvm use && npm i -g pnpm@10

pnpm install
pnpm prepare         # lefthook git-hooks
pnpm dev             # http://localhost:4321 (демон Astro 7: pnpm astro dev stop)
```

Браузеры браузерного набора (`pnpm test:e2e`, шаг `/release`) — Chromium и WebKit Playwright:

```bash
pnpm exec playwright install chromium webkit
pnpm exec playwright install-deps webkit   # только Linux: системные библиотеки WebKit (просит sudo)
```

Как в контейнере — prod-сборка с плейсхолдером origin, штамповка и обёртка сервера
(`pnpm start` читает `.env`, если он есть; шаблон — `.env.example`):

```bash
pnpm build
DIST_DIR=dist SITE_URL=http://localhost:3000 sh docker/entrypoint.sh pnpm start
```

## Команды

```bash
pnpm dev              # astro dev
pnpm build            # astro build → dist/{client,server}
pnpm start            # prod-сервер docker/server.mjs (нужны SITE_URL и штамповка entrypoint'ом)
pnpm typecheck        # astro sync + astro-check (типы .astro и .ts)
pnpm lint             # Biome + ESLint (границы FSD — здесь)
pnpm format:check     # Biome + Prettier для *.astro
pnpm test             # Vitest: unit + Container API (.astro) + axe, покрытие с порогами
pnpm test:http        # после build: HTTP-набор на prod-сервере, профили прод и staging
pnpm test:e2e         # build + браузерный набор: axe, раскладка, переход, петля, тема, форма без JS
pnpm steiger          # структурный линтер FSD
pnpm check:gate       # негативные фикстуры обязаны валить линтеры и скрипты гейта
pnpm check:prose      # проза обвязки: пути, скрипты, скиллы и правила есть в репо; .template; маркеров конфликта нет
pnpm check:content    # контент-гейт: схема .md, даты, тело без скрытой разметки, переводы, ссылки, redirects.yaml
pnpm check:links      # после build: все внутренние ссылки в dist/client существуют
pnpm seo:check        # после build: мета и типы JSON-LD — по плану, сниппет, hreflang, JSON-LD = видимое, острова и ресурсы
pnpm size             # бюджеты: CSS, HTML самой тяжёлой страницы, шрифты ДС, серверный бандл
pnpm ttfb <origin> …  # TTFB запущенного сервера: медиана/p90 20 запросов
pnpm indexnow <origin> [карта-до.xml] --key <ключ>   # IndexNow после выката: адреса, которые изменил релиз
pnpm geo:probe <origin>     # GEO-шаг /seo-audit: проба соседнего strategy по шаблонам страниц (advisory)
pnpm bots:sources           # источники сетей ботов реестра — configs/crowdsec/ai-bots.sources хаба <org>/infra
pnpm accept:image <image>   # приёмка собранного образа до пуша в registry
pnpm template:update        # обвязка шаблона в форк: новые теги шаблона, перенос до тега — TO=vX.Y.Z
pnpm check            # gate — состав: .claude/rules/tests-pipeline.md § Gate
```

Перед claim «готово» / push — **`pnpm check`** (его же гоняет pre-push — для пушимого HEAD на
чистом дереве).

## Структура

Feature-Sliced Design, импорты строго нисходящие (`app → pages → widgets → features →
entities → shared`); между слайсами одного слоя — запрещены. Границы держит ESLint
(`boundaries` с резолвером + `no-restricted-imports`), структуру — Steiger; `.gate-fixtures/`
с заведомыми нарушениями входит в gate, чтобы линтеры не деградировали молча.

```
content/redirects.yaml   адреса как данные: переезды старого сайта и 410, один хоп с любой формы адреса
strategy/         данные страниц в форме strategy на месте снимка: проект шаблона (бриф, карта, планы,
                  copy deck по языкам, факты) и копии каталогов базы kb/ — читает shared/strategy
public/           иконки, manifest, og-default.png (социальная карточка 1200×630)
src/app/          layouts/document.astro (<head> из props: SeoHead + JSON-LD), middleware, styles/{tokens,index}.css
src/pages/        роутинг Astro = слой pages: страница — один файл на все локали в [...locale]/
                  (index, about, contacts/{index,spasibo}, legal/privacy,
                  blog/{index,[slug],page/[page],tag/[tag]}, rss.xml — prerender), 500;
                  404, healthz, robots.txt, [key].txt, api/contact (on-demand); файлы
                  страниц — _home/, _about/, _contacts/, _privacy/, _blog/; тесты маршрутов и
                  страниц — _tests/
src/widgets/      блоки каталога strategy (пропсы — элементы анатомии, вариант — каталога): hero-text,
                  feature-grid, prose, contact-details, lead-form, thank-you, not-found, legal-text,
                  article-cards, article-body, related-links и каркас — header, footer, breadcrumbs
                  (их ставит оболочка по секциям плана страницы)
src/features/     contact-form (форма без JS и её обработчик), preferences (остров предпочтений:
                  тема и движение)
src/entities/     post: content/<locale>/*.md + covers/, model, api, lib; author: реестр авторов
                  (в шаблоне пуст): имя, роль и профиль для подписи записи
src/shared/       config (runtime env, Zod; идентичность сайта), i18n, lib (+ testing), redirects,
                  seo (absoluteUrl, hreflang, SeoHead, JSON-LD, robots/sitemap/rss), strategy (чтение
                  снимка: страница и шаблон коллекции — модулем по id, секции плана, тексты по ключу,
                  факты, мета; контракт блока), antispam (шов капчи),
                  observability (JSON-лог с порогом LOG_LEVEL, Sentry по DSN), ui
src/{content.config,middleware,env.d}.ts   навязанные Astro entry — тонкие входы
docker/           Dockerfile (4 стадии), entrypoint.sh + stamp.mjs (штамповка SITE_URL), server.mjs
e2e/              Playwright на prod-сборке: http/ — в гейте, browser/ — в /release
scripts/          гейты (check-gate, check-content, check-links, seo-check, lib/), validate-plan,
                  pre-push, ttfb, indexnow, geo-probe, bot-sources, accept-image, template-update
.template/        версия обвязки шаблона и пути шаблона — их переносит в форк template-update
docs/stack/       формы платформенных артефактов (12 kinds) — заполняет /stack-deep-dive
.claude/          правила (path-scoped) и скиллы (init-service, scaffold, content, release…)
```

## Контент

Страница — блоки каталога strategy (`src/widgets/<block-id>`) в порядке секций её плана; тексты и мета — copy
deck по ключу `page/section/slot`, контакты и реквизиты — факты: данные `strategy/` в форме strategy. Нет секции,
слота, текста или факта — красная сборка, литерал текста в разметке страниц и блоков — красные `lint` и тест
страниц.

Записи — Markdown в `src/entities/post/content/<locale>/<slug>.md` с frontmatter под
Zod-схему (`title` 25–65, `description` 70–170, `pubDate`, `tags`, `translationKey`,
`draft`, обложка с `alt`, `author` — id из реестра авторов). Язык задаёт каталог; переводы
связаны `translationKey`, непереведённое под `/en/` — 404, черновики видны только в
`astro dev`. Списки — `/blog`, `/blog/page/N`, `/blog/tag/<tag>` (страница тега индексируется от
трёх записей локали, ниже — `noindex` и вне карты сайта); всё prerender.
Инварианты и гейты — rule `.claude/rules/content-invariants.md`.

## Режимы рендера

Всё prerender по умолчанию; on-demand (`export const prerender = false`) — только служебное:
`404`, `/healthz`, `robots.txt`, файл ключа IndexNow и обработчик формы `/api/contact`; фиды и карта
сайта — файлы сборки. Кеш-заголовки, карта маршрутов, рецепт живой страницы на запрос и рецепт кеша
процесса для контента из CMS —
[`docs/reference/rendering.md`](docs/reference/rendering.md).

## Форма обратной связи

`/contacts` — обычная HTML-форма без JavaScript: браузер шлёт POST на `/api/contact`, сервер
проходит лестницу origin-check → лимит и форма тела → honeypot → валидация (согласие на
обработку ПДн проверяется и на сервере) → шов капчи и доставляет заявку одним каналом
(`FORM_DELIVERY=smtp|backend`, три попытки). Успех — 303 на `/contacts/spasibo`, ошибка — та же
страница с сохранёнными полями, сбой канала — честный 500; отказ до разбора заявки — короткий
текст (403, 400, 413). Тело заявки не логируется. Rate-limit на этот путь ставится на edge —
требование контракта [`infra-handoff.md`](docs/reference/infra-handoff.md). Правило —
`.claude/rules/forms-antispam.md`; политика обработки ПДн — `/legal/privacy`: текст — copy deck
страницы `privacy`, реквизиты оператора — факты проекта (у шаблона — демо, `example: true`).

## SEO

`<head>` каждой страницы собирает `DocumentLayout` из props (`meta`, `translations`, `jsonLd`,
`crumbs`): мета copy deck как есть (бренд — в заголовке), self-canonical, полный OG (`og:image` — кадр 1200×630
обложки записи или `public/og-default.png`), `twitter:card`, hreflang по карте переводов страницы —
только для реальных переводов (взаимно, + `x-default`), RSS autodiscovery фида своей локали.
JSON-LD — в `<head>`, типы `seo.structured_data` плана страницы: `Organization` + `WebSite` на главной,
`AboutPage`, `ContactPage` + `LocalBusiness` на контактах — одна организация с `@id` `<origin>/#org`
(контакты и реквизиты — `machine` фактов страницы), на неё ссылаются сайт, страницы и записи;
`CollectionPage` у списка и тега, `BreadcrumbList` у страниц шаблона карты с крошками, с глубины 2
(из того же пропа оболочки, что видимые крошки `widgets/breadcrumbs`), `Article` у записи — с автором
`Person`, когда у записи есть автор из реестра и подпись; в `<body>` ни одного `<script>`. Первая иконка в `<head>` — PNG 192×192:
растр, который подходит выдаче Google. `robots.txt` (`ROBOTS_POLICY`; политика ИИ-ботов — поле сборки `AI_BOTS_POLICY`,
группы — из реестра ботов базы strategy; `Clean-param` Яндексу — служебные параметры адреса
`CLEAN_PARAMS`) и `/<INDEXNOW_KEY>.txt` — on-demand на runtime `SITE_URL`; `sitemap.xml` (сборка пишет его по
страницам `dist/client`: ровно страницы без `noindex`, `lastmod` — дата правки или публикации
записи) и фиды `rss.xml` каждой локали блога — файлы сборки, origin в них штампуется при старте
контейнера. Гейты: `pnpm seo:check` и HTTP-набор
(`e2e/http/`: сырой HTML, тот же ответ каждому боту реестра, robots, карта, фиды) в `pnpm check`;
правило — `.claude/rules/seo-invariants.md`.

Видимость в ИИ-ответах (GEO) держит тот же слой: поисковому роботу и ИИ-боту сервер отдаёт тот же
ответ, что человеку, а кого пускать, решает политика ИИ-ботов в `robots.txt`; организация в
разметке одна, у записи — автор; скрытую разметку и даты из будущего в записи отклоняет
`check:content`, словам учит `/content`. После выката `/seo-audit` гоняет пробу базы strategy
(`pnpm geo:probe`), а `pnpm indexnow` сообщает поисковикам адреса, которые изменил релиз.
`llms.txt` и «версии для ИИ» шаблон не публикует — `docs/reference/seo.md § Чего шаблон не делает`.

## Один образ на все среды

Сборка печёт `site: 'https://__site_origin__'`; при старте контейнера
`docker/entrypoint.sh` штампует `SITE_URL` в `dist/client` (HTML, XML, TXT) и проверяет,
что плейсхолдера не осталось, а `docker/server.mjs` добавляет keep-alive и graceful
shutdown под Traefik и отказывается стартовать, если env не проходит схему `shared/config`
(значение ключа вне формата, нет реального `SITE_URL`). Подробности —
[`docs/reference/deployment.md`](docs/reference/deployment.md).

## UI

Компоненты пишутся в проекте как `.astro` на ролях дизайн-системы: значения — файл токенов
`src/app/styles/tokens.css` в форме производного `ds_build` соседнего strategy (две темы —
блоками `data-theme` и `prefers-color-scheme`), роли компонентам раздаёт слой сопоставления
«утилита → роль» в `src/app/styles/index.css` (Tailwind v4 `@theme inline`); вендорных UI-китов
нет. Из JavaScript в шаблоне только острова — предпочтения посетителя (инлайн-`<script>` в
`<head>`: ставит выбор темы и движения до первой отрисовки и обслуживает кнопки) и счётчик при заданном
`METRIKA_ID`; CSP каждой страницы пропускает инлайн-острова по хешу тела, а внешний источник — только
счётчику (`tag.js` с `mc.yandex.ru`, строка острова в `ISLANDS`). Картинки мастеров контента —
`astro:assets` (`<Picture>`: AVIF и фолбэк WebP, размеры заданы, обложка записи грузится с
приоритетом), готовые файлы ДС и ролик-петля — примитивы `shared/ui/media` (кадр под устройство,
роль слота, ролик — только при разрешённом движении). Скрипты, чужие ресурсы, размеры картинок и
роликов, кадры устройства и приоритет LCP каждой страницы проверяет `seo:check`, CSP — HTTP-набор,
сырые `<img>`, `<video>` и цвета мимо токенов — ESLint, доступность, раскладку и
нарушения CSP — браузерный набор в обеих темах на `/release`.

## Из шаблона — в свой сайт

Форк проходит путь «онбординг → платформа → разворот → свои страницы»: `/init-service`
ведёт по этапам, `/stack-deep-dive` заполняет `docs/stack/*.md`, `/de-template`
подставляет идентичность и реквизиты оператора и чистит reference-набор, `/scaffold` и
`/content` добавляют своё, `/seo-audit` и `/release` выпускают. Путь целиком —
[`docs/getting-started.md`](docs/getting-started.md).

## Документация

| Документ | О чём |
|---|---|
| [`docs/README.md`](docs/README.md) | карта документации |
| [`docs/getting-started.md`](docs/getting-started.md) | путь потребителя: форк → свой сайт |
| [`docs/reference/architecture.md`](docs/reference/architecture.md) | FSD под Astro: слои, public API, кто держит границы |
| [`docs/reference/rendering.md`](docs/reference/rendering.md) | режимы рендера, карта маршрутов, кеш-заголовки, рецепт кеша процесса |
| [`docs/reference/seo.md`](docs/reference/seo.md) | что держит шаблон, чек-лист страницы, три контура staging |
| [`docs/reference/deployment.md`](docs/reference/deployment.md) | образ, entrypoint, server.mjs, env-контракт |
| [`docs/reference/observability.md`](docs/reference/observability.md) | JSON-лог, `X-Request-Id`, `/healthz`, Sentry |
| [`docs/reference/ecosystem.md`](docs/reference/ecosystem.md) | место среди шаблонов stit, флоу работы из хаба `<org>/infra` и контракты с соседями |
| [`docs/reference/infra-handoff.md`](docs/reference/infra-handoff.md) | контракт сервиса `site` с `<org>/infra`: образ, требования к среде и edge, боты, приёмка |
| [`.claude/rules/forms-antispam.md`](.claude/rules/forms-antispam.md) | форма без JS: PRG, антиспам-лестница, согласие на ПДн, доставка |
| [`CLAUDE.md`](CLAUDE.md) | гайд для агента (ядро + роутер) |

## Часть экосистемы stit

Это один из открытых шаблонов stit (Apache-2.0) — фундамент «-1 уровня»,
берите бесплатно и владейте. Карта всех шаблонов и точка входа —
**[витрина stit](https://git.stit.tech/stit-core/stit-public)**. Нужна
команда, стандарт или поддержка — **[наш подход и контакты (vision)](https://git.stit.tech/stit/vision)**.

## Лицензия

**Apache-2.0** — см. [`LICENSE`](LICENSE).
