---
id: stack.routing
kind: routing
name: routing
status: draft
---

# routing

## Как устроены маршруты

| поле | значение |
|---|---|
| источник | файлы `src/pages` — 1 файл = 1 URL; подпапки = сегменты URL |
| параметрические | `[slug].astro` + `getStaticPaths()` из контента |
| секции страниц | `src/pages/_<name>/` — префикс `_` вне роутинга |
| формат сборки | `build.format: 'directory'` → `/about/index.html`, адрес без `.html` |
| хвостовой слеш | `trailingSlash: 'never'`: `/blog/` → 301 `/blog` |
| регистр | не нормализуется — URL к нему чувствительны, canonical = реальный адрес |

## Локали в URL

| locale | префикс | пример |
|---|---|---|
| `ru` | нет (дефолтная) | `/blog/<slug>` |
| `en` | `/en` | `/en/blog/<slug>` |

Физические каталоги `src/pages/en/**`; ru/en-обёртки делят одну разметку секции.
Авторедиректов по `Accept-Language` нет — язык выбирает человек ссылкой в шапке.

## Карта страниц

Перечень — из `pages.md` FSD-карты поверхности (`<strategy-path>/docs/projects/<slug>/fsd/<surface>/`).
Режим и заголовки кеша каждой строки — в `rendering.md`; здесь только адреса и происхождение.

| путь | происхождение | локали |
|---|---|---|
| `/` | `src/pages/index.astro` | `ru`, `en` |
| `/blog`, `/blog/page/N`, `/blog/<slug>`, `/blog/tag/<tag>` | коллекция `post` | `ru`, `en` |
| `/about`, `/contacts`, `/contacts/spasibo` | статические страницы | `ru`, `en` |
| `/legal/privacy` | статическая страница | `ru` |
| _<path>_ | _файл или коллекция_ | _локали_ |

## Редиректы и нештатные коды

| ситуация | ответ | где |
|---|---|---|
| переезд URL | `301` (или `308`, если метод обязан сохраниться) | `content/redirects.yaml` → `app/middleware` |
| удалено навсегда | `410` + `noindex` | там же |
| путь без файла | `404` + `noindex` | `src/pages/404.astro` (on-demand) |
| ошибка рендера on-demand | `500` + `noindex` | `src/pages/500.astro` |

Редиректы — данные, один хоп, без цепочек; `meta refresh` и `redirects` в
`astro.config.ts` не используются. Дубль каждой страницы по `<путь>/index.html` (200 без CSP)
закрывает Traefik — 301 на путь без `/index.html`.

## Навигация

| элемент | что в нём |
|---|---|
| шапка | _пункты меню_ + переключатель локали и темы |
| подвал | _ссылки_ + политика ПДн, RSS |
| хлебные крошки | вложенные страницы: один массив в `<Breadcrumbs>` и в `breadcrumbList()` |

## Generates

- `src/pages/**` — файлы маршрутов и `getStaticPaths()`
- `src/pages/_<name>/` — секции страниц
- `content/redirects.yaml`
- строки в `rendering.md § Карта маршрутов` и в `STATIC_ROUTES` (`src/pages/sitemap.xml.ts`)
- `src/shared/i18n/dict.ts` — подписи навигации

## Открытые вопросы

- _что_
