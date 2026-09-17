# SEO

Что шаблон держит сам, что остаётся решением проекта и чем это проверяется.
Нормативная часть — правило `.claude/rules/seo-invariants.md`; прогон аудита — скилл
`/seo-audit`; чек-лист релиза — `/release`.

Главный принцип: **всё, что читает краулер, — в первом HTML-ответе**. Не в островке, не
после гидрации, не за `server:defer`. Поэтому контентные страницы prerender, JavaScript
на них нет, а разметка одинакова для человека и для бота (клоакинга нет; e2e ходит с
`User-Agent: Googlebot` и сверяет ровно тот же HTML).

## Что даёт шаблон из коробки

| что | где живёт |
|---|---|
| `<head>` из пропсов страницы: title-шаблон, description, self-canonical, OG, `twitter:card`, RSS autodiscovery | `app/layouts/document.astro` + `shared/seo/seo-head.astro` |
| hreflang только для реальных переводов, взаимно, + `x-default` | `shared/seo/urls.ts` (`alternates`) |
| JSON-LD в `<head>`: `Organization`/`WebSite`, `LocalBusiness`, `BreadcrumbList`, `BlogPosting` | `shared/seo/json-ld.ts` + проп `jsonLd` layout'а |
| видимые хлебные крошки из того же массива, что разметка | `widgets/breadcrumbs` |
| `robots.txt`, `sitemap.xml`, `rss.xml`, файл ключа IndexNow на runtime origin | `src/pages/*.ts` + `shared/seo` |
| честные статусы: 404, 410, 301/308 одним хопом, 500 | `app/middleware` + `content/redirects.yaml` |
| абсолютные URL на реальном домене в любом контуре | штамповка `SITE_URL` при старте контейнера |

Решение проекта (шаблон не угадывает): бренд и описание, канонический хост, дефолтная
OG-картинка, набор локалей, политика AI-краулеров, токены верификации, ключ IndexNow.
Все они — в `docs/stack/seo.md` и подставляются `/de-template`.

## Чек-лист новой страницы

Проходится при `/scaffold page`; те же пункты держит `seo:check`.

1. **Индексируется?** Да — prerender (`static`), self-canonical, в карте сайта.
   Нет — проп `noindex`, вне карты, `Cache-Control` по смыслу ответа.
2. **`title`** — уникальный среди всех страниц, без имени сайта (суффикс добавляет
   шаблон), ≤ 65 символов.
3. **`description`** — уникальный, 70–170 символов, отвечает на «что здесь», а не
   пересказывает заголовок.
4. **Canonical** — собирается сам из пути; ручное переопределение только с обоснованием,
   на чужой домен — никогда.
5. **hreflang** — есть перевод ⇒ `alternatePath`; нет ⇒ проп не ставится, и ни одной
   `<link hreflang>` не печатается.
6. **`og:image`** — обложка записи или дефолт сайта 1200×630; URL абсолютный, файл в сборке.
7. **JSON-LD** — только про видимое и только из белого списка типов; `FAQPage`, `HowTo`,
   `SearchAction` не генерируются.
8. **Крошки** — у вложенной страницы один массив: и в `<Breadcrumbs>`, и в
   `breadcrumbList(crumbs)`.
9. **Карта сайта** — индексируемая страница вне коллекций ⇒ строка в `STATIC_ROUTES`
   (`src/pages/sitemap.xml.ts`).
10. **404** — неизвестный параметр отдаёт 404, а не редирект на главную и не пустую
    страницу с кодом 200.
11. **Пагинация** — у каждой страницы списка свой `title`/`description`/`h1` с суффиксом
    номера и self-canonical; переходы — настоящие `<a href>`.
12. **Ровно один `<h1>`** — текстом, не картинкой; в теле заголовки от `##`.
13. **Картинки** — `alt`, `width`/`height`, `<Picture>` с фолбэком `src`; LCP-картинка
    без `lazy`, с `fetchpriority="high"`.
14. **Кеш** — публичная страница `public, max-age=0` + ETag (адаптер), живая или
    персональная `private, no-store` (роут).
15. **Приватное** — `guard ≠ public` ⇒ `noindex` + `private, no-store` + вне карты сайта.

## Три контура staging

`<meta name="robots">` на prerendered-странице — значение **сборки**, а образ один на все
среды. Поэтому не-прод закрывается снаружи, тремя независимыми контурами:

1. `ROBOTS_POLICY=noindex` ⇒ `robots.txt` = `Disallow: /` и `X-Robots-Tag` на on-demand
   ответах;
2. Traefik: `basicAuth` — настоящий замок (prerendered до приложения не доходит);
3. Traefik: `customResponseHeaders: X-Robots-Tag` — на всё, включая статику.

На проде наоборот: отдельные `noindex`-страницы (`/now`, 404, подтверждение заявки) в
`robots.txt` **не** закрываются — закрытую обходом страницу робот не прочитает и не
увидит `noindex`.

## Чем проверяется

| уровень | что ловит |
|---|---|
| unit `shared/seo/*.test.ts` | `absoluteUrl`, `alternates`, `buildRobotsTxt`, `buildSitemap`, `buildFeed`, фабрики JSON-LD (их выход проходит Zod-схему) |
| Container API | `seo-head.astro`, `json-ld.astro`, `widgets/breadcrumbs` — разметка и axe |
| `pnpm seo:check` (в `pnpm check`) | весь `dist/client`: один `<title>` и `<h1>`, description, self-canonical, `lang`, OG с существующей картинкой, уникальность сниппетов, полные пары hreflang, типы JSON-LD |
| `pnpm check:links` | каждый внутренний `href`/`src`/`srcset` сборки существует |
| `pnpm check:content` | бюджеты и уникальность полей записей, ссылки в теле, `redirects.yaml` |
| `e2e/seo.spec.ts` | сырой HTML живого сервера, в т.ч. под Googlebot: статусы, мета, hreflang, JSON-LD в `<head>` и ни одного `<script>` в `<body>`, `robots.txt` ↔ `sitemap.xml` ↔ `dist/client`, фиды, ключ IndexNow, вес HTML |
| `/seo-audit` | прогон всего вышеперечисленного + curl по живому домену + внешние валидаторы |

Ручное — раз на релиз: Rich Results Test, validator.schema.org, валидатор микроразметки
Яндекса, PageSpeed Insights (mobile).

## Чего шаблон не делает

- не генерирует OG-картинки на лету — обложка рисуется руками и лежит в контенте;
- не нормализует регистр URL: адреса чувствительны к регистру, canonical = реальный адрес;
- не выводит `Host`, `Crawl-delay`, `changefreq`, `priority` — мёртвые директивы;
- не ставит `<meta name="keywords">` и не размечает то, чего нет на странице;
- не редиректит по `Accept-Language`: язык выбирает человек, а бот должен видеть оба.
