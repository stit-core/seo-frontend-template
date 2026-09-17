# Фаза 5 — reference-слайсы и «красиво»: отчёт

Принято главной сессией после ревью диффа и сводных правок; ниже — итоговое состояние.

## 1. Сделано
- **Страницы**: `pages/{about,en/about}.astro`, `pages/{contacts,en/contacts}/{index,spasibo}.astro`, `pages/legal/privacy.astro` (плейсхолдеры оператора, только ru), `pages/500.astro` (адаптер отдаёт `500.html` при исключении), `pages/api/contact.astro` (обработчик формы — страница, не endpoint: «200 + форма с ошибками» без JS), секции `_about/`, `_contacts/` (ru/en делят разметку)
- **`features/contact-form`**: `model/schema.ts` (Zod, `consent: z.literal(true)`, бюджеты полей), `api/handler.ts` (origin-check против runtime `SITE_URL` → honeypot → валидация → шов капчи → доставка; 400 на битое тело, 413 на тело > 64 КБ — оба без Sentry; лог без тела заявки), `api/delivery.ts` (`smtp` — динамический `nodemailer`, `backend` — `fetch` с таймаутом; 3 попытки, backoff; ненастроенный канал — честный 500 без ретраев), `ui/contact-form.astro` (нативная форма, `role="alert"`, `aria-invalid`/`aria-describedby`, ловушка, согласие со ссылкой на политику)
- **`features/theme`** — единственный остров: `theme-init.astro` (один инлайн-`<script>` в `<head>`, 431 Б: cookie `scheme` → `data-scheme` до первой отрисовки + делегированный обработчик), `theme-toggle.astro` (кнопка видна только при `data-js`)
- **`entities/company`**, **`shared/antispam`** (`CaptchaVerifier`, только `none`), **`shared/observability`** (`log.ts` — один JSON-логгер с порогом `LOG_LEVEL` для middleware и формы; `sentry.ts` — `@sentry/node` динамически, только при `SENTRY_DSN`), **`app/analytics/metrika.astro`** (одна точка; `METRIKA_ID` из `site.ts`, пусто — ни одного стороннего скрипта)
- **Дизайн**: токен-слой переписан (палитра «бумага/чернила + зелёный акцент», шкала типографики, `max-w-page`, `.button/.field/.note/.section-title`), шапка с навигацией и `aria-current`, подвал со ссылками, главная ru/en, `<Picture>` в карточке и статье (AVIF/WebP + фолбэк, обложка — LCP с `fetchpriority="high"`, миниатюры `lazy`), новые `public/og-default.png` и три обложки записей в палитре шаблона
- **SEO/конфиг**: `localBusiness()` + Zod-схема; `site.ts` — `METRIKA_ID`, `SITE_VERIFICATION` (google/yandex), `PRIVACY_POLICY_VERSION`; env формы/капчи/Sentry в `runtime.ts`; `STATIC_ROUTES` в `sitemap.xml.ts`; `App.Locals.rid`; `astro.config.ts` — `security.checkOrigin: false` (origin проверяет форма) и `bodySizeLimit: 1 МБ` у адаптера
- **Гейты и доки**: `seo-check.mjs` (служебные prerendered-страницы, `LocalBusiness`, запрет HTML-комментариев в выходе); `e2e/{forms,a11y}.spec.ts` + приёмник `e2e/form-stub.mjs` вторым `webServer`; правило `forms-antispam.md`; обновлены `shared-ui`, `seo-invariants`, `env-local`, `render-safety`, `tests-pipeline`, `CLAUDE.md`, `README.md`, `CONTRIBUTING.md`, `docs/reference/{deployment,rendering}.md` (чек-лист прокси: rate-limit на `/api/contact`, `X-Forwarded-*`), `.env.example`, `biome.json`, `.prettierignore`, `.size-limit.cjs`

## 2. Зависимости
| пакет | версия | зачем |
|---|---|---|
| `nodemailer` | 10.0.10 | канал `FORM_DELIVERY=smtp`, динамический импорт только при отправке |
| `@sentry/node` | 10.75.0 | серверные исключения при `SENTRY_DSN`, без трассировки |

Образ: 355 МБ (+52 МБ на эти два пакета).

## 3. Проверено
- `pnpm check` — exit 0: typecheck 0; lint/format clean; vitest 35 файлов / 162 теста; steiger; `check:gate`; `check:content` 12; build 34 страницы + `500.html`; `check:links` 802; `seo:check` 34 (hreflang 22, пар 11); size: CSS 4.24, HTML главной 4.39 / en 3.82 / поста 4.37 kB gzip
- `pnpm test:e2e` — 80 passed: формы (PRG + доставка в приёмник, `required`, ловушка без доставки, 200 с сохранёнными полями и `private, no-store`, 500 при недоступном канале, 403 на чужой Origin и без Origin, 303 при Origin сайта и чужом `Host`, 400 на битое тело, 413 на большое, 303 на GET), a11y (6 страниц × 2 темы, выбор темы/cookie/перезагрузка, нет кнопки без JS), «внешних скриптов нет, инлайн — только остров темы»
- Образ (`accept-image.sh` + curl фазы): fail-fast без `SITE_URL`, плейсхолдеров 0, TTFB 1.1 мс, `docker stop` < 300 мс; `/about`, `/contacts`, `/legal/privacy` 200 и в sitemap (32 URL), `spasibo`/`500` вне карты; за «прокси» (`Host` + `X-Forwarded-Proto: https` + `Origin: https://…`): валидная → 500 (канал недоступен), honeypot → 303, без Origin → 403, чужой Origin → 403, json → 400, `Content-Length` 99999999 → 413; в логе нет имени/почты; 0 HTML-комментариев в выходе
- Визуально (Browser pane, light/dark × desktop/375): главная, запись с обложкой, «О компании», контакты — контраст и фокус в порядке, мобильная шапка в две строки, не «шаблонно-серое»

## 4. Отклонения от спецификации
- Time-trap не реализован: метку выдаёт рендер формы, а `/contacts` prerendered; `FORM_TIME_TRAP_SECRET` не заводится (правило `forms-antispam`)
- `security.checkOrigin` Astro выключен: за TLS-терминирующим прокси адаптер строит URL запроса как `http://…`, встроенная проверка отвечала бы 403 на любой POST из браузера; origin проверяет `contact-form` против runtime `SITE_URL`; без `Origin`/`Referer` — 403
- Остров темы — 431 Б против ≤ 300 Б brief: честный минимум без потери FOUC-защиты и обработчика (`matchMedia`, атрибуты cookie, `addEventListener`); одна мера — тест `theme-init.astro.test.ts` (бюджет 500 Б), строки в `.size-limit.cjs` нет — байты входят в бюджеты HTML
- Тема хранится только в cookie; `api/contact` — `.astro`-страница; `METRIKA_ID`/verification — поля `site.ts` (решение владельца); `ANALYTICS` env нет — пустой `METRIKA_ID` и есть «аналитики нет»
- `/legal/privacy` — только ru (en ссылается с `hreflang="ru"`); rate-limit — на Traefik (чек-лист в `deployment.md`), не в приложении
- Обложки трёх записей перерисованы в палитре шаблона

## 5. Осталось / риски
- Канал `smtp` проверен только на ветке «не настроен»: живого SMTP в гейте нет
- Sentry — ленивая инициализация на первом исключении; полный трейсинг потребует init до импорта приложения (`docker/server.mjs`)
- `/500` собирается как `dist/client/500.html` — `seo:check` обходит `index.html`, покрыт e2e
- `image.responsiveStyles: true` инлайнит стили картинок; ширину миниатюры держит обёртка

## 6. Данные для фазы 6
**Prune-лист `/de-template` (лендинг без блога)**: `entities/post` (+ `content/**`, обложки), `widgets/post-list`, `pages/blog/**`, `pages/en/blog/**`, `pages/_blog/**`, `pages/{rss.xml,en/rss.xml}.ts`, тесты post, `e2e/content.spec.ts`; строки: реестр `collections` в `scripts/lib/content.mjs`, импорт коллекции в `src/content.config.ts`, блоговые ветки `pages/sitemap.xml.ts` (оставить `STATIC_ROUTES`), ключи `blog.*` в `dict.ts`, «Блог» в шапке, RSS в подвале и `<link rel="alternate">` в `seo-head.astro`, бюджет «HTML поста» в `.size-limit.cjs`, слаги в `e2e/{seo,rendering,a11y}.spec.ts`, `content/redirects.yaml`. Остаются `pages/{index,about,contacts,legal/privacy,500,api/contact}`, `features/{contact-form,theme}`, `entities/company`, `shared/**`
**Плейсхолдеры оператора** (`/de-template` падает, пока не заменены): `{{OPERATOR_NAME}}`, `{{OPERATOR_INN}}`, `{{OPERATOR_ADDRESS}}`, `{{OPERATOR_EMAIL}}` — все в `src/pages/legal/privacy.astro`
**Карта маршрутов** (`docs/reference/rendering.md`): `/about`, `/contacts`, `/legal/privacy` (static, в sitemap), `/contacts/spasibo`, `/500` (static, noindex, вне карты), `/api/contact` (dynamic, `private, no-store`, noindex)
**Env**: `FORM_DELIVERY`, `SMTP_URL`, `FORM_TO`, `FORM_FROM`, `FORM_BACKEND_URL`, `CAPTCHA_PROVIDER`, `CAPTCHA_SECRET`, `CAPTCHA_FAIL_MODE`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT` — `.env.example` + таблица `deployment.md`, ни один не в HTML
**Точки для скиллов**: `shared/config/site.ts` (идентичность, OG, `METRIKA_ID`, `SITE_VERIFICATION`, `PRIVACY_POLICY_VERSION`), `entities/company/model/company.ts`, `public/og-default.png`, `content/redirects.yaml`, `STATIC_ROUTES`, `.size-limit.cjs`, `e2e/site.ts`; требования к прокси — `deployment.md` (чек-лист оператора) — вход handoff-документа фазы 7
