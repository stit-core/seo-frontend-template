# Stack-артефакты

Дизайн платформы сайта — **первичный source of truth** и **вход скила
`/de-template`**: singleton-артефакт на kind, заполняется через
`/stack-deep-dive`.

Где FSD-карта в `../strategy` (`docs/projects/<slug>/fsd/<surface>/`) отвечает
на «как нарезано», `docs/stack/` отвечает на «на какой платформе крутится»:
откуда контент, какие маршруты и режимы рендера, какой origin, какие env, как
собирается и деплоится образ.

В каноническом репозитории шаблона заполненных `docs/stack/<kind>.md` нет —
только формы в `_templates/`. Формы приходят **с дефолтами шаблона**: Astro 7
(`output: 'static'`), контент — Markdown в git, i18n `ru` + `en`, один Node-образ
и штамповка `SITE_URL` при старте, 0 JS по умолчанию. Потребитель
подтверждает дефолт или меняет его — и тогда меняет код по `Generates`.

## Kinds

| kind | файл | обязателен | что описывает |
|---|---|---|---|
| `service` | `service.md` | да | имя, scope, repository, registry, `infra-svc`, резолв strategy |
| `runtime` | `runtime.md` | да | Node-процесс: адаптер, порт, graceful shutdown, `/healthz`, память |
| `content` | `content.md` | да | источник контента, коллекции и схемы, локали, черновики, картинки, **кто редактирует** |
| `routing` | `routing.md` | да | URL-карта: происхождение маршрутов, локали, слеши, редиректы, 404/410 |
| `rendering` | `rendering.md` | да | режим на маршрут, кеш-заголовки, абсолютные URL, острова |
| `seo` | `seo.md` | да | идентичность сайта, OG, JSON-LD, hreflang, robots, sitemap, фиды, верификации |
| `styling` | `styling.md` | да | токен-слой, тема, шрифты, бюджеты CSS |
| `api` | `api.md` | **условный** | обработчики форм и внешние источники данных |
| `analytics` | `analytics.md` | **условный** | счётчики, пиксели, баннер согласия |
| `observability` | `observability.md` | да | JSON-лог процесса, `X-Request-Id`, `/healthz`, Sentry |
| `config` | `config.md` | да | роллап env + колонка «в HTML?» и публичные идентификаторы сайта |
| `dependencies` | `dependencies.md` | да | пакеты вне базовой подборки и бюджеты `size-limit` |

Условный kind заводится по ответу в первой волне `/stack-deep-dive`:

- сайт принимает что-то от посетителя (форма, подписка) или берёт данные извне
  (CMS, бэкенд) ⇒ `api.md`;
- на сайте будет счётчик, пиксель или баннер согласия ⇒ `analytics.md`.

Незаведённый условный kind — нормальное состояние, а не дыра: файла просто нет. Условный kind помечает его форма
(«Условный kind.» до первой секции) — по ней `pnpm check:stack --stable` его файла не ждёт.

Отдельного kind `images` нет — пайплайн картинок описывает секция «Картинки»
артефакта `content.md`: у контентного сайта картинки приходят вместе с текстом.

## Порядок волн

```
service → runtime → content → routing → rendering → seo → styling
        → api (усл.) → analytics (усл.) → observability → config → dependencies
```

Порядок не произвольный: маршруты выводятся из коллекций (`content` → `routing`),
режим — из маршрутов (`routing` → `rendering`), индексируемость — из режима
(`rendering` → `seo`), а `config` собирает env, которые родились в предыдущих
волнах, поэтому идёт предпоследним.

## Frontmatter

```yaml
id: stack.<kind>
kind: <kind>
name: <kind>
status: draft
```

`status` — `draft` (заполняется) или `stable` (принят, по нему работает
`/de-template`). Третьего значения нет.

## Workflow

1. Скопировать нужные `_templates/<kind>.md` → `docs/stack/<kind>.md`
2. `/stack-deep-dive` — волнами подтвердить дефолты и записать проектные решения
3. Промоушн `draft → stable` — решение в каждой секции формы держит `pnpm check:stack` (шаг `pnpm check`)
4. `/de-template` читает stable-артефакты и разворачивает фундамент

## Gate

`/de-template` не запускается, пока не выполнено всё:

- `pnpm check:stack --stable` зелёный: все обязательные kinds и все **заведённые** условные — `status: stable`, у
  каждого — секции его формы и в каждой решение, `Generates` включительно, а не заглушка формы;
- нет открытых `**blocker**` в `.claude/skills/stack-deep-dive/state/`;
- cross-kind инварианты сходятся: каждая страница FSD-карты есть в карте
  маршрутов `rendering.md`; `indexable` не противоречит `guard`; каждый env,
  объявленный любым kind'ом, доехал в `config.md`; редактор без git ⇒ источник
  контента не `git`.
