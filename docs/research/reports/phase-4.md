# Фаза 4 — SEO-слой: отчёт

Принято главной сессией после трёх независимых ревью диффа (корректность / соответствие спеке /
упрощение) и сводных правок; ниже — итоговое состояние.

## 1. Сделано
- **создано**: `src/shared/seo/{urls,meta,json-ld,robots,sitemap,rss}.ts` + `seo-head.astro`, `json-ld.astro`, `index.ts` (только внешне используемые экспорты), тесты (pure + Container API; Zod-схема JSON-LD проверяет выход каждой фабрики в `json-ld.test.ts`); `src/widgets/breadcrumbs/` (только видимые крошки, без `<script>`); `src/pages/{robots.txt,sitemap.xml,rss.xml,[key].txt}.ts`, `en/rss.xml.ts`, `_blog/feed.ts` (on-demand, runtime env); `scripts/seo-check.mjs` (`pnpm seo:check`, в `pnpm check` после `check:links`), `scripts/lib/{html,content}.mjs` (один парсер `<head>`/`decode` и один реестр коллекций для `seo-check`, `check-content`, `check-links`, `e2e/seo.spec.ts`); `e2e/seo.spec.ts` (14 тестов через `request`, в т.ч. Googlebot UA), `e2e/site.ts` (`prerenderedPaths()`, демо-ключ IndexNow e2e-профиля); `public/og-default.png` (1200×630, цвета токен-слоя — плейсхолдер до дизайна); `.claude/rules/seo-invariants.md`
- **изменено**: `app/layouts/document.astro` — `<head>` из props (`title`, `description`, `alternatePath`, `noindex`, `ogType/ogImage/article`, `jsonLd`); все страницы `src/pages` + `_blog/*` (JSON-LD и крошки из одного массива на странице, `og:image` = обложка); `shared/config/{runtime,site,index}.ts` (`INDEXNOW_KEY`, `AI_TRAINING`; `SITE_DESCRIPTION`, `SITE_SAME_AS`, `SITE_LOGO_PATH`, `OG_DEFAULT_IMAGE`); `shared/i18n/dict.ts`; `e2e/{playwright.config,rendering.spec,content.spec}.ts`; `package.json`, `.env.example`, `CLAUDE.md`, `README.md`, `docs/README.md`, `docs/reference/{rendering,deployment}.md`, rules `tests-pipeline`, `env-local`, `fsd-architecture`, `render-safety`, `content-invariants`
- не тронуто: `docker/*`, `astro.config.ts`, `shared/redirects` и `app/middleware/redirects.ts` (как в фазе 2), `docs/stack`, скиллы

## 2. Зависимости
| пакет | версия | зачем |
|---|---|---|
| `@astrojs/rss` | 4.0.19 (= brief §4.6, latest) | RSS 2.0 без своего XML-билдера: `getRssString` + `customData` (atom:link self, language), `trailingSlash: false` |

Опции: `X-Robots-Tag: noindex` на robots/sitemap/фидах/ключе (не страницы выдачи); `Cache-Control` robots/ключ 300 с, sitemap 3600 с, фиды 600 с; `WebSite` только на `/` (`/en` — `Organization`); ключ IndexNow — `pages/[key].txt.ts` (перехватывает весь корневой `*.txt`, кроме статического `robots.txt`; чужое имя — 404 `text/plain`).

## 3. Проверено
- `pnpm check` — exit 0: typecheck 0 errors; lint/format clean; vitest 26 файлов / 125 тестов; steiger, check:gate, check:content 12 записей; build 27 страниц; check:links 406 ссылок; seo:check 27 страниц (с hreflang 18, пар переводов 9); size: CSS 3.21, HTML главной 2.0 / en 1.66 / поста 2.92 kB gzip
- `pnpm test:e2e` — 50 passed (smoke 12, content 16, rendering 8, seo 14)
- Негативные пробы `seo:check`: страница без canonical/description-`content`, с `keywords`, вторым `h1`, без hreflang у twin-пары → 13 нарушений, exit 1; после восстановления — ok
- Образ (`accept-image.sh` + curl фазы): 303 МБ; без `SITE_URL` fail-fast; плейсхолдеров в `dist/client` 0; TTFB медиана 0.9 мс; `docker stop` < 300 мс; `ROBOTS_POLICY=index` → `Allow: /` + абсолютный `Sitemap:`; `noindex` → `Disallow: /` без Sitemap + `X-Robots-Tag` на on-demand; `AI_TRAINING=deny` → группа 6 обучающих ботов; sitemap 27 URL своего origin, все 200, без черновика, `lastmod` только у записи с `updatedDate`; фиды ru 8 / en 3; hreflang взаимный + `x-default` только при twin; JSON-LD только в `<head>`, в `<body>` ни `<script>`, ни абсолютных URL своего origin, ни `<!--`
- `pnpm kin:diff` — корзина «идентично» совпадает; визуально (Browser pane, light/dark, 375 px) — крошки читаются, вёрстка цела

## 4. Отклонения от спецификации
- Verification-теги (`GOOGLE_SITE_VERIFICATION`/`YANDEX_VERIFICATION`, brief §4.3/§5) не реализованы: на prerendered это значение сборки, образ собирается без env — тег на индексируемых страницах недостижим. Подтверждение домена — HTML-файлом в `public/` или DNS TXT (правило `seo-invariants`, `deployment.md`). Штамповка токенов в `entrypoint.sh` — правка `docker/*`, решение владельца
- `BreadcrumbList` — норма (канон S-2 SHOULD), не условие красной сборки: `seo:check` проверяет форму блока там, где он есть
- Фильтр адресов `redirects.yaml` в sitemap не нужен: `check:content` (до `build`) запрещает `from` на живом маршруте, а карта строится ровно из живых маршрутов
- `Clean-param` — строка в `buildRobotsTxt`/правиле (список пуст); hreflang в sitemap не дублируется; шардов нет (27 URL, `buildSitemap` бросает > 50 000)
- Канон I-5 (нормализация регистра 308-м) не реализован: URL чувствительны к регистру (решение фазы 2) — строка в Backlog

## 5. Осталось / риски
- `<meta name="robots">` на prerendered — сборочный; staging держат `ROBOTS_POLICY` (on-demand) + Traefik (инфра, фаза 7)
- `og:image` обложки — исходный PNG 1600×900 (16:9, не 1.91:1); дизайн `og-default.png` и `<Picture>` обложек — фаза 5; `docs/reference/seo.md` и `/seo-audit` — фаза 6
- `@astrojs/rss` тянет `fast-xml-parser`/`piccolore` в prod-deps образа
- Третья локаль потребует `alternates()` с картой переводов (сейчас «другая локаль» — единственная кроме текущей)

## 6. Данные для следующих фаз
| путь | файл | режим | Cache-Control | индексируется | в sitemap |
|---|---|---|---|---|---|
| `/`, `/en`, `/blog*`, `/en/blog*` | как в фазе 3 | static | `public, max-age=0` + ETag | да (canonical, hreflang при переводе, OG, JSON-LD в `<head>`) | да — ровно prerendered |
| `/robots.txt` | `robots.txt.ts` | dynamic | `public, max-age=300` + `X-Robots-Tag: noindex` | — | нет |
| `/sitemap.xml` | `sitemap.xml.ts` | dynamic | `public, max-age=3600` + noindex | — | сам |
| `/rss.xml`, `/en/rss.xml` | `rss.xml.ts`, `en/rss.xml.ts` → `_blog/feed.ts` | dynamic | `public, max-age=600` + noindex | — | нет |
| `/<INDEXNOW_KEY>.txt` (весь корневой `*.txt`) | `[key].txt.ts` | dynamic | `public, max-age=300` + noindex; 404 `no-cache` + noindex | — | нет |
| `/now`, `/healthz`, 404/410/301 | как в фазе 3 | dynamic | без изменений; 404/`now` — `noindex` без canonical/OG | нет | нет |
- env фазы: `INDEXNOW_KEY` (файл, 8–128 `[a-zA-Z0-9-]`), `AI_TRAINING` (`allow|deny` → `robots.txt`); e2e-профиль задаёт `INDEXNOW_KEY`. `PUBLIC_CONFIG_KEYS` = `SITE_URL`, `ROBOTS_POLICY`; любой публичный ключ фазы 5 (`METRIKA_ID`, `CAPTCHA_SITE_KEY`) в разметку — только через `getPublicConfig()`, и только на on-demand он живой
- Точки фазы 5: `OG_DEFAULT_IMAGE` (`shared/config/site.ts`) + `public/og-default.png` — заменить дизайном (1200×630 зашито в конфиг); обложки — `<Picture>` в `PostArticle`, `og:image` уже берёт `cover.src`; `DocumentLayout` — `<slot name="head">` для инлайн-скрипта темы, `<body>` без `<script>` — e2e это проверяет, остров темы потребует явного исключения (инлайн без `src`) и строки в `.size-limit.cjs`; новые страницы (`about`, `contacts`, `legal`) — `DocumentLayout` + `Breadcrumbs` + `jsonLd={[breadcrumbList(crumbs)]}` из одного массива (плоская страница без крошек — не ошибка), `LocalBusiness` — по образцу `organization()`; `spasibo` — `noindex`; `api/contact` — строка в карте `rendering.md`, вне sitemap (карта строится только из контента и списков); `seo:check` требует уникальные `title`/`description` и hreflang у каждой пары путей под обоими префиксами локалей
