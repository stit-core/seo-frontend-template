# Прунинг reference-набора

Reference-набор шаблона — **живой образец**, а не технический долг: по нему видно, как
устроены коллекция, страница, форма, остров и служебный маршрут. Чистится он **после**
того, как собственные страницы спроектированы и сгенерированы.

Режим выбирается в Gate-5 `/de-template`.

## Что остаётся в любом режиме

`src/pages/[...locale]/{index,about,contacts/*,legal/privacy}`,
`src/pages/{404,500,healthz,robots.txt,[key].txt,api/contact}`,
файлы страниц `_about/`, `_contacts/`, `_privacy/`, `src/features/{lead-form,preferences}`,
`src/widgets/{header,footer,breadcrumbs}` и блоки страниц, данные `strategy/`,
`src/shared/**`, `src/app/**`, `.gate-fixtures/`, `docker/`, `scripts/`, гейты. Фикстуры гейта на
гейт не правятся ни в каком режиме: у мини-проектов `.gate-fixtures/` свой реестр коллекций, и
прунинг или переименование коллекций сайта их не касаются.

Форма и политика ПДн — не «демо»: это минимум сайта, который принимает заявки.

Цели e2e выводятся из сборки и контента (`e2e/site.ts`): смена или удаление записей, тегов и
редиректов правок в `e2e/` не требует.

---

## Режим «с блогом»

Коллекция `post` остаётся, меняется её содержимое.

1. Удалить демо-записи и обложки: `src/entities/post/content/{ru,en}/*.md`,
   `src/entities/post/content/covers/*`
2. Написать свои — `/content` (минимум по одной записи на локаль, иначе списки пусты)
3. `content/redirects.yaml` — демо-записи убрать, вписать адреса своего старого сайта
4. Проверить бюджет HTML в `.size-limit.cjs` (`pnpm size`): он меряет самую тяжёлую страницу
   сборки, а своя вёрстка записи может весить иначе
5. Переименовать коллекцию под свой домен (`post` → `article`, `case`, `vacancy`) — если
   переименовываешь: каталог слайса, `src/content.config.ts`, реестр `scripts/lib/content.mjs`,
   импорты `@/entities/post`, маршруты `src/pages/[...locale]/blog/**`

---

## Режим «без блога»

Коллекций контента не остаётся вовсе; сайт — набор статических страниц и формы.

### Удалить

```
src/entities/post/            слайс коллекции целиком (контент, схема, запросы, пути, тесты)
src/entities/author/          реестр авторов: записей с автором не остаётся
src/widgets/article-cards/      свежие записи главной и списки блога — блок, который без блога не ставит ни один план
src/widgets/article-body/  src/widgets/related-links/   тело записи и «связанные» — блоки страниц блога
strategy/site/<поверхность>/plans/{blog,post,tag}.yaml  strategy/site/<поверхность>/copy/{blog,post,tag}*.yaml
src/pages/[...locale]/blog/  src/pages/_blog/
src/pages/[...locale]/rss.xml.ts
src/pages/_tests/blog.astro.test.ts
src/shared/seo/rss.ts  src/shared/seo/rss.test.ts
```

### Поправить (порядок удобный, не обязательный)

| файл | что |
|---|---|
| `src/content.config.ts` | убрать импорты коллекции и реестра авторов → `export const collections = {}` |
| `scripts/lib/content.mjs` | `collections = []`, убрать импорты из удалённых слайсов |
| `scripts/check-content.mjs` | импорт `SLUG_RE` вёл в слайс — заменить локальной константой `const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/` |
| `strategy/site/<поверхность>/site-map.yaml` | убрать страницы `blog`, `post`, `tag`, коллекции `posts` и `tags` и ссылки на них (`chrome`, `linking`, `build_order`): без страницы блога в карте `<head>` не печатает автообнаружение фида |
| `src/pages/_home/home-page.astro` | убрать запрос записей (`listPosts`) и блок свежих записей (`ArticleCards`); второй путь первого экрана — на свою страницу (цель в плане главной) |
| `strategy/site/<поверхность>/plans/*.yaml`, `copy/*.yaml` | пункт блога в шапке — строка `chrome.header.items` карты и подпись `nav-link` секции `header` плана и copy deck каждой страницы (число подписей = числу пунктов карты, иначе сборка падает); раздел блога в подвале — экземпляр группы `nav` секции `footer`, путь в блог на 404 — экземпляр группы `route` секции `not-found`; секция свежих записей главной (`article-cards`) — из её плана и copy deck (у секции плана без блока шаблона тест контракта красный) |
| `src/shared/seo/seo-head.astro`, `src/app/layouts/document.astro` | убрать проп `feed` и автообнаружение фида: его подпись — строка `blog.feed` словаря, она уходит с ключами `blog.*` |
| `src/shared/seo/index.ts` | убрать реэкспорт `buildFeed` |
| `src/shared/seo/seo-head.astro.test.ts` | убрать кейс фида своей локали |
| `src/shared/i18n/dict.ts` | убрать ключи `blog.*`, `post.*`, `author.*` в словаре каждой локали |
| `content/redirects.yaml` | демо-записи (их цель `/blog` уходит вместе с блогом — `check:content` это поймает) |
| `src/app/middleware/redirects.test.ts` | если таблица пустая — условие «непуста» меняется на «строится» |
| `src/app/middleware/index.server.test.ts` | кейс «адреса … до роутинга» ходит по демо-адресам `/old` и `/blog/staraya-zametka` — заменить своими из `redirects.yaml` (нет `410` — убрать его половину кейса) |
| `src/pages/_tests/fixtures.ts`, `src/pages/_tests/post-body.astro` | удалить вместе с `vi.mock('astro:content')` и `vi.mock('@/entities/author')` в тестах маршрутов: коллекции нет |
| `src/pages/_tests/pages.astro.test.ts` | убрать строку маршрута `/[...locale]/blog` |
| `docs/reference/rendering.md` | убрать строки блога и фидов из карты маршрутов |

### Что при этом **не** трогать

`shared/seo/{urls,sitemap,json-ld,robots}` и `widgets/breadcrumbs` — они про любую
страницу, а не про блог. `POSTS_PER_PAGE`/`paginate` уходят вместе со слайсом: своя
пагинация появится вместе со своей коллекцией.

---

## Демо-значения (любой режим)

Идентичность заменяется на этапе A `/de-template`, проверка — здесь же:

```bash
pnpm check:identity                          # строки и файлы лица шаблона в файлах форка — по одной строке
grep -n 'example: true' strategy/facts*.yaml # демо-факты: реквизиты оператора не настоящие
```

Тексты и реквизиты reference-страниц — данные `strategy/` (copy deck и факты): `check:identity`
называет в них имя шаблона, бренд, имя бизнеса и проект брифа, имя оператора, его реквизиты и
контакты и улицу адреса — и короткой формой («ул. Примерная»), и перенесённую строкой. Часы,
сроки и даты демо-фактов он не называет — их значения законно повторит форк: факт с
`example: true` находит grep выше.

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
