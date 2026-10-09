---
name: seo-audit
description: Прогнать SEO- и GEO-аудит сайта существующими гейтами — прод-сборка, pnpm seo:check по dist/client, HTTP-набор pnpm test:http на поднятом prod-сервере, curl по живому домену (статусы, robots, sitemap, нормализация URL), проба доступности для поисковых и ИИ-ботов pnpm geo:probe утилитой соседнего strategy — и собрать короткий отчёт с тем, что чинить. Применяй, когда нужно проверить SEO или выдачу, видимость в ИИ-ответах, разобраться, почему страница не индексируется или в выдаче не тот сниппет, и после выката новой версии.
---

# Skill: seo-audit

Тонкий скилл: **своих парсеров и проверок не пишет** — запускает те, что уже в репо, и
читает их вывод. Всё, что он может найти, держат `pnpm seo:check`, HTTP-набор `e2e/http/`,
десяток curl'ов и проба `pnpm geo:probe` (утилита базы соседнего strategy); ценность скилла — в
порядке прогона и в сведении результата.

Инварианты, которые проверяются, — `.claude/rules/seo-invariants.md`.

## Когда применять

- «/seo-audit», «проверь SEO», «проверь выдачу», «видит ли нас ИИ-поиск»
- «страница не индексируется», «в выдаче не тот заголовок», «нейросеть нас не цитирует»
- После выката новой версии (шаг 9 `/release`)

## Границы

Сначала отчёт, правки — по решению юзера (§ Отчёт). HTML разбирает только существующий парсер
`<head>` — `scripts/lib/html.mjs`, разовые скрипты-парсеры не пишутся. Запросы — к домену из
задачи и к внешним валидаторам из шага 5, не дальше.

## Прогон

### 1. Локальные гейты по сборке

```bash
pnpm build          # плейсхолдер origin, как в образе
pnpm check:links    # каждый внутренний href/src в dist/client существует
pnpm seo:check      # head каждой страницы: title/description, canonical, lang, h1, OG, hreflang, JSON-LD; карта = страницы
pnpm size           # бюджеты HTML и CSS
```

`seo:check` падает построчно и человекочитаемо — вывод кладётся в отчёт как есть.

### 2. Поведение на поднятом сервере

```bash
pnpm test:http      # после pnpm build: HTTP-набор, профили прод и staging
```

Набор поднимает копию сборки как контейнер (`docker/entrypoint.sh` + `docker/server.mjs`) на
свободных портах и проверяет сырой HTML (в том числе под `User-Agent: Googlebot`, а шаблоны
страниц и on-demand маршруты — под UA каждого бота реестра: ответ тот же до заголовка): статусы и
заголовки, штамповку origin, `noindex` и острова на on-demand страницах (prerendered держит
`seo:check`, карту сайта против сборки — тоже), `robots.txt` (прод и staging), проштампованные
карту и фиды, ключ IndexNow, вес HTML.

### 3. Живой домен (или запущенный контейнер)

Порядок пунктов — чек-лист релиза, короткая версия. `ORIGIN` — прод-домен или
`http://127.0.0.1:<порт>`.

```bash
curl -sI  $ORIGIN/                        # 200, нет X-Robots-Tag: noindex
curl -s   $ORIGIN/robots.txt              # на проде группа * — Allow: /, строка Clean-param, абсолютный Sitemap:
curl -s   $ORIGIN/sitemap.xml | grep -c '<loc>'   # ожидаемое число, все URL на своём домене по https
curl -sI  $ORIGIN/net-takogo-puti         # 404 — не 200 и не редирект на главную
curl -sI  $ORIGIN/about/                  # один 301 на /about (хвостовой слеш)
curl -sI  $ORIGIN/about/index.html        # один 301 на /about — дубля страницы по другой форме адреса нет
curl -s   $ORIGIN/ | grep -oE '<link rel="canonical"[^>]*>|<html[^>]*>|<h1'   # canonical, lang, один h1
```

Признак беды, который эти строки ловят чаще всего: `noindex` уехал в прод
(`ROBOTS_POLICY` не переключён после staging), canonical на плейсхолдере или на чужом
домене (штамповка не отработала), 404 отвечает 200 (soft-404), sitemap пуст.

### 4. GEO: доступность для поисковых и ИИ-ботов

```bash
pnpm geo:probe $ORIGIN      # после pnpm build; сосед — strategy-path из docs/stack/service.md
```

Проба базы соседнего strategy (`geo_probe.py --ua-probe`) идёт по шаблонам страниц сборки — по
одной странице на маршрут: `robots.txt` глазами каждого бота реестра сайта, текст и разметка в
сыром HTML, ответ под UA поисковых и ИИ-ботов против браузерного. `ORIGIN` — канонический origin
сервера (его `SITE_URL`): по другому адресу каждая страница получит флаг `canonical-elsewhere`.
Заодно копия реестра ботов `src/shared/seo/crawlers.yaml` сверяется с файлом базы.

Читать вывод по группам строки страницы:

- **чинить** — флаги серьёзности B и S (таблица `checks` в `head-kit.yaml` базы): закрытый
  поисковик (`blocked-*`), `noindex` на индексируемой странице, ответ по UA бота не тот, что
  браузеру (`ua-<бот>-status-403` — бота режет edge: allowlist в `infra-handoff.md § 1.5`),
  недоверенный сертификат, заглушка антибота. Код выхода при них — 1
- **ожидаемо** — флаг даёт решение самого сайта: страница закрыта сборкой (служебная, тонкий
  тег) или политика `deny-all` закрывает ИИ-ботов и ставит свои мета (`bingbot noarchive`,
  `applebot nosnippet` — по реестру) — в «чинить» не идёт. Та же директива всем роботам
  (`<meta name="robots" content="nosnippet">`) или заголовком `X-Robots-Tag` — уже не политика:
  «чинить»
- **к сведению** — флаги D (короткий текст, нет JSON-LD у служебной страницы): решать по смыслу

На живом домене проба видит то, чего нет локально: WAF и CrowdSec, TLS, CDN. Соседа или
окружения его утилит нет — команда печатает строку пропуска и выходит с 0; строка идёт в отчёт
как есть. Реестр расходится с базой — заменить копию файлом базы вместе с `CRAWLERS_SHA256`
(`scripts/lib/site-policy.mjs`).

### 5. Внешние валидаторы (руками, ссылки в отчёт)

- Rich Results Test — `search.google.com/test/rich-results`
- Schema Markup Validator — `validator.schema.org`
- Микроразметка Яндекса — `webmaster.yandex.ru/site/tools/microtest/`
- PageSpeed Insights (mobile) по 2–3 ключевым URL

## Отчёт

Коротко, без пересказа вывода целиком:

```
seo-audit · <домен или dist/client>

зелёное: build, check:links (802 ссылки), seo:check (34 страницы, 11 пар hreflang), size
красное:
  • /services — description дублирует /about (seo:check)
  • /old-price — 200 вместо 410: строка есть в redirects.yaml, но файл страницы вернулся
GEO: реестр ботов — копия равна базе; 16 шаблонов, чинить:
  • /blog/<slug> — S ua-PerplexityBot-status-403: бота режет edge
чинить: 1) переписать description /services; 2) удалить src/pages/old-price.astro;
        3) allowlist ИИ-ботов в CrowdSec — задание для <org>/infra
дальше руками: Rich Results Test по /blog/<slug>, PSI mobile по главной
```

Правки — отдельным проходом, после «да» юзера: description и title живут рядом со
страницей или во frontmatter записи, маршруты — в `docs/reference/rendering.md`.
