# Чек-листы полей по kind

Выжимка для скилла: что должно быть непусто к `stable`, что правит `/de-template`,
куда роллапится решение, на чём чаще всего спотыкаются. Полный канон — формы
`docs/stack/_templates/<kind>.md` и каталог `docs/stack/README.md`.

Дефолты шаблона уже зашиты в формы; волна спрашивает только проектные вариации.

---

## service

**Секции**: `Идентичность`, `Домены`, `Связь с экосистемой`, `Generates`.

**Generates**: `package.json#name`, шапка `README.md`, registry-путь образа для `/release`,
`SITE_NAME`/`SITE_SAME_AS` в `src/shared/config/site.ts`.

**Cross-kind**: `infra-svc` → `make bump SVC=<…>` в handoff `/release`; канонический хост
из `Домены` → `seo.md § Идентичность` и `SITE_URL`; `project-slug`/`strategy-path`/`surface`
— резолв FSD-карты для `/scaffold` и `/de-template`.

**Anti-patterns**: имя пакета осталось `@stit/ssr-frontend-template`; теги `:latest`/`:edge`;
два «канонических» хоста.

---

## runtime

**Секции**: `Процесс`, `Сборка`, `Браузеры`, `Generates`.

**Generates**: `.nvmrc`/`engines`, `docker/Dockerfile`, таймауты `docker/server.mjs`,
строки для compose в `<org>/infra`.

**Cross-kind**: `SHUTDOWN_TIMEOUT_MS` ≤ `stop_grace_period` сервиса; `mem_limit` ↔
`NODE_OPTIONS=--max-old-space-size` (≈ 75 %); порт ↔ `HEALTHCHECK`.

**Anti-patterns**: предсжатие HTML на сборке (штамповка не заглянет внутрь архива);
`read_only: true` у сервиса (штамповка пишет в `/app/dist/client`).

---

## content

**Секции**: `Источник`, `Кто редактирует`, `Коллекции`, `Локали контента`, `Черновики`,
`Картинки`, `Редиректы`, `Поиск по сайту`, `Generates`.

**Generates**: слайс коллекции (`content/`, `model/{schema,collection}.ts`, `api/queries.ts`,
`ui/`), регистрация в `src/content.config.ts` и в реестре `scripts/lib/content.mjs`,
страницы списка и записи, источник фидов, hreflang и дат карты сайта, `content/redirects.yaml`.

**Cross-kind (блокирующий)**: `Кто редактирует` = «редактор без git» при источнике `git` —
`**blocker**`: публикация записи означает релиз образа. Либо редактор идёт через PR, либо
источник `cms`/`api`, и тогда его маршруты в `rendering.md` — `cached`/`dynamic`.

**Anti-patterns**: поле `lang` во frontmatter (язык задаёт каталог); fallback «показать
русскую версию под `/en`» (это дубль, нужен 404); коллекция без записи в реестре
`scripts/lib/content.mjs` — каталог вне реестра валит `check:content`, а пары переводов не сверит
`seo:check`.

---

## routing

**Секции**: `Как устроены маршруты`, `Локали в URL`, `Карта страниц`, `Редиректы и
нештатные коды`, `Навигация`, `Generates`.

**Generates**: файлы `src/pages/**` и `getStaticPaths()`, секции `src/pages/_<name>/`,
`content/redirects.yaml`, подписи навигации в `src/shared/i18n/dict.ts`; карту сайта пишет сборка
по страницам `dist/client`.

**Cross-kind**: каждая строка `pages.md` FSD-карты — строка здесь; каждая строка отсюда —
режим в `rendering.md`.

**Anti-patterns**: хвостовой слеш в ссылках и в `to` редиректа; цепочка редиректов
(`to` совпал с чьим-то `from`); адрес из `redirects.yaml`, ставший живым маршрутом; «исправленный»
`from` — адрес старого сайта пишется как был (заглавные, кириллица, слеш, `?query`).

---

## rendering

**Секции**: `Режимы`, `Карта маршрутов`, `Абсолютные URL и один образ на все среды`,
`Интерактивность (острова)`, `Generates`.

**Generates**: `export const prerender` и заголовки в `src/pages/**`, строки в
`docs/reference/rendering.md`, строки `ISLANDS` (`scripts/lib/site-policy.mjs`), HTTP-набор
`e2e/http/`.

**Cross-kind**: `indexable: да` ⇒ режим `static` или `cached` (никогда `dynamic`/`client`);
каждый остров ⇒ строка `ISLANDS` с основанием, страницами и бюджетом; источник контента не `git` ⇒
у его маршрутов режим не `static`.

**Anti-patterns**: `prerender = false` на контентной странице; request-only API
(`Astro.request`, cookies, `url.search`) в prerender-маршруте; `Astro.site` для
абсолютных URL; server islands на индексируемой странице.

---

## seo

**Секции**: `Идентичность сайта`, `Социальные карточки`, `Структурированные данные`,
`Локали и hreflang`, `robots-политика`, `Sitemap и фиды`, `Верификация`, `Кабинеты`, `Generates`.

**Generates**: `src/shared/config/site.ts`, `src/shared/seo/*`, маршруты `robots.txt`, фидов и
ключа IndexNow, карта сайта из сборки (`scripts/lib/sitemap.mjs`), `e2e/http/seo.spec.ts`.

**Cross-kind**: канонический хост ↔ `service.md § Домены` ↔ `SITE_URL` в `config.md`;
`ROBOTS_POLICY`, `INDEXNOW_KEY` — в `config.md`; политика ИИ-ботов — поле `AI_BOTS_POLICY` в
`site.ts`, не env; служебные параметры адреса — `CLEAN_PARAMS` там же (рекламные метки проекта ↔
`analytics.md`); набор локалей ↔ `content.md`.

**Anti-patterns**: `<meta name="keywords">`; canonical на другой домен; `FAQPage`/`HowTo`/
`SearchAction` «ради rich results»; hreflang на несуществующий перевод; verification-токен
или политика ИИ-ботов в env (prerendered их не увидит — они в `site.ts`); свой список ботов в
`robots.txt` мимо реестра `shared/seo/crawlers.yaml`.

---

## styling

**Секции**: `Источники`, `Палитра и семантика`, `Тема`, `Шрифты`,
`Типографика, отступы и размеры`, `Бюджет`, `Generates`.

**Generates**: `src/app/styles/{tokens,index}.css`, бюджеты CSS/HTML в `.size-limit.cjs`,
`src/features/preferences/**`.

**Cross-kind**: веб-шрифт ⇒ строка веса в `dependencies.md § Бюджеты`; остров предпочтений ⇒
строка в `rendering.md § Интерактивность`.

**Anti-patterns**: сырой цвет или размер в компоненте вместо токена; цвета в scoped-CSS;
веб-шрифт без сабсета кириллицы.

---

## api (условный)

**Секции**: `Входящие обработчики`, `Антиспам-лестница`, `Доставка заявки`,
`Внешние источники данных`, `Generates`.

**Generates**: `src/pages/api/**`, слайс формы, шов капчи, строки в карте маршрутов и в
чек-листе прокси `deployment.md`, `e2e/{http,browser}/forms.spec.ts`, env формы в `config.md`.

**Cross-kind**: rate-limit на публичный POST — **требование деплоя**, строка в
`deployment.md`; согласие на ПДн ⇒ страница политики в `routing.md`; внешний источник,
читаемый на запрос ⇒ `cached`/`dynamic` в `rendering.md`.

**Anti-patterns**: обработчик формы как `.ts`-endpoint (без JS ответом на POST обязана быть
разметка); счётчик rate-limit в памяти процесса; тело заявки в логе; зарубежный
форм-сервис как канал доставки.

---

## analytics (условный)

**Секции**: `Счётчики`, `Что не работает в РФ`, `ИИ-рефереры`, `Согласие`, `Бюджет`, `Generates`.

**Generates**: `src/app/analytics/*`, идентификаторы в `site.ts`, баннер согласия,
острова в `ISLANDS` (основание, страницы, бюджет; хеш тела и origin счётчика пропускает CSP) и
чужие origin в `RESOURCE_ORIGINS` (`scripts/lib/site-policy.mjs`, их держат `seo:check` и CSP).

**Cross-kind**: идентификатор счётчика — поле `site.ts`, не env (`config.md § Публичные
идентификаторы`); баннер — остров, строка в `rendering.md` и в `ISLANDS`.

**Anti-patterns**: счётчик синхронно в `<head>`; подключение из виджета или страницы мимо
единственной точки `app/analytics`; GA4 как основная аналитика для российской аудитории.

---

## observability

**Секции**: `Лог процесса`, `Ошибки`, `Клиентская телеметрия`, `Здоровье`, `Generates`.

**Generates**: `src/shared/observability/*`, строка лога в `app/middleware`,
`src/pages/healthz.ts`, env в `config.md`.

**Cross-kind**: `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `LOG_LEVEL`, `RELEASE` — в `config.md`;
алерты — в handoff `<org>/infra`.

**Anti-patterns**: `console.*` мимо `log()`; PII, query, cookie или тело запроса в логе;
RUM-скрипт на контентной странице ради метрик.

---

## config

**Секции**: `Runtime env контейнера`, `Публичные идентификаторы сайта`, `Секреты`, `Generates`.

**Generates**: `src/shared/config/{runtime,site}.ts`, `.env.example`,
`docs/reference/deployment.md § Env-контракт`, список ключей для `.env` VPS.

**Cross-kind (роллап)**: env, объявленный любым kind'ом, обязан быть здесь; расхождение —
`**blocker**` в `state/config.md`.

**Anti-patterns**: секрет с пометкой «в HTML: да»; чтение `process.env` мимо
`shared/config`; публичный идентификатор сайта, заведённый как env (prerendered его не увидит).

---

## dependencies

**Секции**: `Базовая подборка`, `Обновления` (правило шаблона: ритм, N / N−1, условия пересмотра
стека — подтверждается, отличие проекта — с причиной), `Проектные добавления`, `Запрещено`,
`Бюджеты`, `Generates`.

**Generates**: `package.json`, строки `.size-limit.cjs`, прунинг в `docker/Dockerfile`.

**Cross-kind**: каждый пакет, упомянутый другим kind'ом, — строка здесь; бюджеты ↔
`styling.md` и `rendering.md`.

**Anti-patterns**: пакет без обоснования; дубль того, что уже даёт базовая подборка;
инструмент разработки в `dependencies` (уедет в прод-образ).
