# Прунинг reference-набора

Reference-набор шаблона — **живой образец**, а не технический долг: по нему видно, как
устроены коллекция, страница, форма, остров и служебный маршрут. Чистится он **после**
того, как собственные страницы спроектированы и сгенерированы.

Режим выбирается в Gate-5 `/de-template`.

## Что остаётся в любом режиме

`src/pages/{index,about,contacts/*,legal/privacy,404,500,now,healthz,robots.txt,[key].txt,api/contact}`,
секции `_about/`, `_contacts/`, `src/features/{contact-form,theme}`,
`src/entities/company`, `src/widgets/{site-header,site-footer,breadcrumbs}`,
`src/shared/**`, `src/app/**`, `.gate-fixtures/`, `docker/`, `scripts/`, гейты. Фикстуры гейта на
гейт не правятся ни в каком режиме: у мини-проектов `.gate-fixtures/` свой реестр коллекций, и
прунинг или переименование коллекций сайта их не касаются.

Форма и политика ПДн — не «демо»: это минимум сайта, который принимает заявки. Страница
`/now` — образец режима `dynamic`; если проекту она не нужна, удаляется вместе со строкой в
карте маршрутов `docs/reference/rendering.md`, импортом и кейсом в
`src/pages/_tests/pages.astro.test.ts`, ссылкой в подвале (`site-footer.astro`, его тест и ключ
`footer.now` в `dict.ts` — иначе `check:links` упадёт на `/now`) и упоминаниями `/now` в
`e2e/http/service.spec.ts` и `e2e/browser/a11y.spec.ts`.

Цели e2e выводятся из сборки и контента (`e2e/site.ts`): смена или удаление записей, тегов и
редиректов правок в `e2e/` не требует.

---

## Режим «с блогом»

Коллекция `post` остаётся, меняется её содержимое.

1. Удалить демо-записи и обложки: `src/entities/post/content/{ru,en}/*.md`,
   `src/entities/post/content/covers/*.png`
2. Написать свои — `/content` (минимум по одной записи на локаль, иначе списки пусты)
3. `content/redirects.yaml` — демо-записи убрать, вписать адреса своего старого сайта
4. Проверить бюджет «HTML поста» в `.size-limit.cjs`: своя вёрстка записи может весить иначе
5. Переименовать коллекцию под свой домен (`post` → `article`, `case`, `vacancy`) — если
   переименовываешь: каталог слайса, `src/content.config.ts`, реестр `scripts/lib/content.mjs`,
   импорты `@/entities/post`, маршруты `src/pages/blog/**`

---

## Режим «без блога»

Коллекций контента не остаётся вовсе; сайт — набор статических страниц и формы.

### Удалить

```
src/entities/post/            слайс коллекции целиком (контент, схема, запросы, ui, тесты)
src/entities/author/          реестр авторов и подпись: записей с автором не остаётся
src/widgets/post-list/
src/pages/blog/  src/pages/en/blog/  src/pages/_blog/
src/pages/rss.xml.ts  src/pages/en/rss.xml.ts
src/shared/seo/rss.ts  src/shared/seo/rss.test.ts
```

### Поправить (порядок удобный, не обязательный)

| файл | что |
|---|---|
| `src/content.config.ts` | убрать импорты коллекции и реестра авторов → `export const collections = {}` |
| `scripts/lib/content.mjs` | `collections = []`, убрать импорты из удалённых слайсов |
| `scripts/check-content.mjs` | импорт `SLUG_RE` вёл в слайс — заменить локальной константой `const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/` |
| `src/pages/{index,en/index}.astro` | убрать `listPosts`/`PostList` и блок «свежие заметки»; CTA — на свою страницу |
| `src/widgets/site-header/ui/site-header.astro` | убрать пункт `/blog` из `items` (+ пути в его тесте) |
| `src/widgets/site-footer/ui/site-footer.astro` | убрать ссылку RSS |
| `src/shared/seo/seo-head.astro` | убрать `<link rel="alternate" type="application/rss+xml">` и `feedTitle` — иначе `check:links` упадёт на несуществующем `/rss.xml` |
| `src/shared/seo/index.ts` | убрать реэкспорт `buildFeed` |
| `src/shared/seo/seo-head.astro.test.ts` | убрать ожидания RSS-ссылки |
| `src/shared/i18n/dict.ts` | убрать ключи `blog.*`, `post.*`, `author.*`, `footer.rss` в обеих локалях |
| `.size-limit.cjs` | убрать бюджет «HTML поста» и вычисление самой тяжёлой записи |
| `content/redirects.yaml` | демо-записи (их цель `/blog` уходит вместе с блогом — `check:content` это поймает) |
| `src/app/middleware/redirects.test.ts` | если таблица пустая — условие «непуста» меняется на «строится» |
| `src/app/middleware/index.server.test.ts` | кейс «адреса … до роутинга» ходит по демо-адресам `/old`, `/blog/staraya-zametka` и `/en/blog/old-note` — заменить своими из `redirects.yaml` (нет `410` — убрать его половину кейса) |
| `src/pages/_tests/fixtures.ts`, `src/pages/_tests/post-body.astro` | удалить вместе с `vi.mock('astro:content')` и `vi.mock('@/entities/author')` в тестах маршрутов: коллекции нет |
| `src/pages/_tests/endpoints.server.test.ts` | describe фидов и их импорты убрать вместе с `vi.mock('astro:content')` |
| `src/pages/_tests/pages.astro.test.ts` | убрать строки `/blog`, `/en/blog` и таблицу маршрутов с параметрами |
| `docs/reference/rendering.md` | убрать строки блога и фидов из карты маршрутов |

### Что при этом **не** трогать

`shared/seo/{urls,sitemap,json-ld,robots}` и `widgets/breadcrumbs` — они про любую
страницу, а не про блог. `POSTS_PER_PAGE`/`paginate` уходят вместе со слайсом: своя
пагинация появится вместе со своей коллекцией.

---

## Демо-значения (любой режим)

Идентичность заменяется на этапе A `/de-template`, но проверить стоит здесь же —
поиском по репозиторию:

```bash
grep -rn 'ssr-frontend-template' --include='*.ts' --include='*.astro' --include='*.md' src docs README.md CLAUDE.md
grep -rn 'example.com\|Пример\|+7 495 000' src/
grep -rn '{{OPERATOR_' src/
```

Литералы, которые не находит переименование пакета: имя сайта в
`src/shared/seo/seo-head.astro.test.ts`, город в
`src/entities/company/ui/company-contacts.astro.test.ts`, тексты reference-страниц.

## После прунинга

```bash
pnpm typecheck        # нет битых импортов
pnpm lint             # границы и формат
pnpm steiger          # структура: public API, сегменты, имена
pnpm test             # тесты удалённых слайсов ушли с ними; пороги покрытия — по факту (rule tests-pipeline)
pnpm check            # полный гейт, включая check:content → build → check:links → seo:check
```

`pnpm check` зелёный — прунинг закончен: `check:links` подтверждает, что в `dist/client` не
осталось ссылок в никуда, а `seo:check` — дублей `title`/`description`.
