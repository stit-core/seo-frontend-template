---
name: seo-audit
description: Прогнать SEO-аудит сайта существующими гейтами — прод-сборка, pnpm seo:check по dist/client, HTTP-набор pnpm test:http на поднятом prod-сервере, curl по живому домену (статусы, robots, sitemap, нормализация URL) — и собрать короткий отчёт с тем, что чинить. Применяй, когда нужно проверить SEO или выдачу, разобраться, почему страница не индексируется или в выдаче не тот сниппет, и после выката новой версии.
---

# Skill: seo-audit

Тонкий скилл: **своих парсеров и проверок не пишет** — запускает те, что уже в репо, и
читает их вывод. Всё, что он может найти, держат `pnpm seo:check`, HTTP-набор `e2e/http/` и
десяток curl'ов; ценность скилла — в порядке прогона и в сведении результата.

Инварианты, которые проверяются, — `.claude/rules/seo-invariants.md`.

## Когда применять

- «/seo-audit», «проверь SEO», «проверь выдачу»
- «страница не индексируется», «в выдаче не тот заголовок»
- После выката новой версии (шаг 7 `/release`)

## Границы

Сначала отчёт, правки — по решению юзера (§ Отчёт). HTML разбирает только существующий парсер
`<head>` — `scripts/lib/html.mjs`, разовые скрипты-парсеры не пишутся. Запросы — к домену из
задачи и к внешним валидаторам из шага 4, не дальше.

## Прогон

### 1. Локальные гейты по сборке

```bash
pnpm build          # плейсхолдер origin, как в образе
pnpm check:links    # каждый внутренний href/src в dist/client существует
pnpm seo:check      # head каждой страницы: title/description, canonical, lang, h1, OG, hreflang, JSON-LD
pnpm size           # бюджеты HTML и CSS
```

`seo:check` падает построчно и человекочитаемо — вывод кладётся в отчёт как есть.

### 2. Поведение на поднятом сервере

```bash
pnpm test:http      # после pnpm build: HTTP-набор, профили прод и staging
```

Набор поднимает копию сборки как контейнер (`docker/entrypoint.sh` + `docker/server.mjs`) на
свободных портах и проверяет сырой HTML (в том числе под `User-Agent: Googlebot`): статусы и
заголовки, штамповку origin, `noindex` и острова на on-demand страницах (prerendered держит
`seo:check`), `robots.txt` (прод и staging) ↔ `sitemap.xml` ↔ `dist/client`, фиды, ключ
IndexNow, вес HTML.

### 3. Живой домен (или запущенный контейнер)

Порядок пунктов — чек-лист релиза, короткая версия. `ORIGIN` — прод-домен или
`http://127.0.0.1:<порт>`.

```bash
curl -sI  $ORIGIN/                        # 200, нет X-Robots-Tag: noindex
curl -s   $ORIGIN/robots.txt              # на проде группа * — Allow: /, абсолютный Sitemap:
curl -s   $ORIGIN/sitemap.xml | grep -c '<loc>'   # ожидаемое число, все URL на своём домене по https
curl -sI  $ORIGIN/net-takogo-puti         # 404 — не 200 и не редирект на главную
curl -sI  $ORIGIN/about/                  # один 301 на /about (хвостовой слеш)
curl -s   $ORIGIN/ | grep -oE '<link rel="canonical"[^>]*>|<html[^>]*>|<h1'   # canonical, lang, один h1
```

Признак беды, который эти шесть строк ловят чаще всего: `noindex` уехал в прод
(`ROBOTS_POLICY` не переключён после staging), canonical на плейсхолдере или на чужом
домене (штамповка не отработала), 404 отвечает 200 (soft-404), sitemap пуст.

### 4. Внешние валидаторы (руками, ссылки в отчёт)

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
чинить: 1) переписать description /services; 2) удалить src/pages/old-price.astro
дальше руками: Rich Results Test по /blog/<slug>, PSI mobile по главной
```

Правки — отдельным проходом, после «да» юзера: description и title живут рядом со
страницей или во frontmatter записи, маршруты — в `docs/reference/rendering.md`.
