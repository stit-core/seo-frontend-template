---
name: de-template
description: Развернуть форк ssr-frontend-template в самостоятельный сайт по stable-артефактам (локальный docs/stack и FSD-карта из соседнего <org>/strategy, docs/projects/<slug>/fsd/<surface>/) — переименовать пакет, подставить идентичность сайта и реквизиты оператора в политику ПДн, переписать README, вычистить демо-контент и лишнюю часть reference-набора. Применяй один раз на форке, когда стек и нужные записи FSD-карты stable и юзер хочет превратить шаблон в свой сайт, или когда /init-service доходит до этапа 3. Механика — правки под этой процедурой с показом диффа, отдельного скрипта нет. На каноническом репозитории шаблона не запускается.
---

# Skill: de-template (движок развёртывания)

Превращает форк в сайт, который ничего не помнит про `ssr-frontend-template`.
Читает **stable**-артефакты — локальный `docs/stack` (секции `Generates`) и
FSD-карту поверхности из соседнего `<org>/strategy`
(`<strategy-path>/docs/projects/<slug>/fsd/<surface>/`; резолв — поля в
`docs/stack/service.md`, дефолт `../strategy`) — и разворачивает фундамент.

Запускается **один раз** на форке. Финал — зелёный `pnpm check` и сайт без следов
шаблона.

## Когда применять

- «/de-template» / «разверни фундамент» / «сделай из шаблона свой сайт»
- `/init-service` дошёл до этапа 3 (FSD-карта в strategy + стек stable)

## Когда НЕ применять

- Стек не `stable` или FSD-карта не готова — сначала `/stack-deep-dive` здесь и
  `/fsd-deep-dive` в `<org>/strategy`
- Проект уже развёрнут (своё имя пакета, демо-фактов оператора нет) — обычный
  день-в-день через `/smartdev`
- **Канонический репозиторий шаблона** — никогда (guard ниже)

## Gate (проверить ДО любых правок)

1. **Не канонический шаблон.** `package.json#name` ещё
   `@stit/ssr-frontend-template` **и** `git remote get-url origin` указывает на
   `stit-core/ssr-frontend-template` → СТОП: это канонический репо или его копия, спроси
   юзера явно подтвердить (допустимо только для одноразовой тест-копии).

2. **Артефакты stable.** Все обязательные kinds и все заведённые условные:
   ```bash
   for k in service runtime content routing rendering seo styling observability config dependencies; do
     grep -q '^status: stable' "docs/stack/$k.md" || { echo "STOP: docs/stack/$k.md не stable"; exit 1; }
   done
   for k in api analytics; do
     [ -f "docs/stack/$k.md" ] && { grep -q '^status: stable' "docs/stack/$k.md" || echo "STOP: docs/stack/$k.md не stable"; }
   done
   ```
   FSD-карта: `fsd/<surface>/` в strategy существует, записи первого разворота — `stable`.

3. **State чист**:
   ```bash
   grep -RlE '\*\*blocker:?\*\*' .claude/skills/stack-deep-dive/state/ 2>/dev/null \
     && echo "STOP: открытые blocker'ы в state — добей сначала" || echo "OK"
   ```

4. **Реквизиты оператора персональных данных.** Спроси четыре значения: название
   (или ФИО ИП), ИНН, адрес, почта для обращений по ПДн. Это факты проекта
   (`strategy/facts*.yaml`), их печатают политика ПДн и подвал, они же — обязанность прямой
   нормы 152-ФЗ. Юзер не может их назвать → **СТОП**: сайт с формой без политики выпускать
   нельзя, и скилл не продолжает. Проверка (демо-факты шаблона несут `example: true`):
   ```bash
   grep -n 'example: true' strategy/facts*.yaml && echo "STOP: реквизиты оператора — демо-факты"
   ```

5. **Режим прунинга.** Спроси одним вопросом: сайт **с блогом** (коллекция `post`
   остаётся, демо-записи заменяются своими) или **без блога** (коллекция и её
   маршруты удаляются целиком). Подробности — `references/prune.md`.

## Этап A — детерминированная механика

Каждый шаг — reviewable edit: показывай дифф, не «сделал молча».

### A.1 Имя пакета

Источник: `docs/stack/service.md § Идентичность` (`scope`).

```bash
NEW_NAME=<scope из service.md>
git grep -lF '@stit/ssr-frontend-template' -- ':!.claude' ':!docs/research' \
  | xargs sed -i "s|@stit/ssr-frontend-template|$NEW_NAME|g"
```

`.claude/skills/**` из замены исключён намеренно: имя шаблона там — **триггер**
скиллов онбординга («форк ещё не развёрнут»), и переименованный триггер сработал бы на
уже развёрнутом проекте. Эти скиллы уходят целиком на шаге A.10.

Проверь `head -3 package.json`. `pnpm install` — только если менялись зависимости.

### A.2 Идентичность сайта → `src/shared/config/site.ts`

Источник: `seo.md § Идентичность сайта`, `§ robots-политика`, `§ Верификация`, `service.md`.

| поле | чем заменить |
|---|---|
| `SITE_NAME` | бренд из `seo.md` |
| `SITE_DESCRIPTION` | описание сайта, 70–170 символов |
| `SITE_SAME_AS` | профили организации (репозиторий шаблона отсюда уходит) |
| `SITE_LOGO_PATH` | логотип из `public/` |
| `PRIVACY_POLICY_VERSION` | дата редакции своей политики, `YYYY-MM-DD` |
| `METRIKA_ID` | id счётчика из `analytics.md`; нет счётчика — пустая строка |
| `SITE_VERIFICATION` | токены Search Console и Вебмастера; нет — пустые строки |
| `AI_BOTS_POLICY` | политика ИИ-ботов из `seo.md § robots-политика`; решения нет — остаётся `allow-all` |
| `CLEAN_PARAMS` | к меткам кликов рекламы — служебные параметры проекта из `seo.md § robots-политика` (сессия, `ref`); своих нет — список как есть |
| `OG_DEFAULT_IMAGE` | своя социальная карточка (путь и размеры); её описание — строка `og.alt` словаря `src/shared/i18n/dict.ts` на каждой локали |

### A.3 Политика ПДн → copy deck `strategy/site/<surface>/copy/privacy.yaml`

Текст политики — copy deck страницы `privacy` проекта strategy, реквизиты оператора — факты
`strategy/facts*.yaml` (оператор — `legal.operator_ref` плана): со strategy форк получает их
снимком (текст юриста), без него правит те же файлы в той же форме. Прочитай текст целиком и
приведи в соответствие с реальными процессами проекта: какие данные собираются, куда уходит
заявка, сколько хранится; число и дата текста — факты (`copydeck.py check` соседа). Дата
редакции — та же, что `PRIVACY_POLICY_VERSION` (A.2). Напомни юзеру два действия вне репо:
показать текст юристу и подать уведомление в РКН о намерении обрабатывать ПДн.

### A.4 Реквизиты организации → факты `strategy/facts*.yaml`

Источник: `seo.md § Структурированные данные` (`LocalBusiness`) и страница «о компании»
в `routing.md`. Оператор, почта, телефон, адрес и часы работы — факты проекта с `machine` (форма
`facts.schema.yaml` strategy, по файлу на язык, те же id), тексты, которые их называют, — copy deck
страниц (`fact_ids`), телефон и почта ссылками — цели действий плана. Разметка `LocalBusiness`
обязана совпадать с тем, что видно в тексте страницы: нет офиса с приёмом — убери адрес и часы и
из фактов, и из секции контактов плана. Имя организации в разметке — бренд `SITE_NAME` (A.2),
`legalName` — оператор плана (`legal.operator_ref`): второе имя у организации `seo:check` считает
второй сущностью.

### A.5 Социальная карточка и иконки → `public/`

`og-default.png` 1200×630 — свой; `icon-192.png` (первая иконка в `<head>` — та, что подходит
выдаче Google; файл — PNG ровно 192×192), `favicon.ico`, `icon.svg`, `icon-512.png`,
`apple-touch-icon.png`, `manifest.webmanifest` — свои имя и цвета. Файлы бинарные:
скилл их не рисует — назови юзеру список и размеры, дождись подмены.

### A.6 Тексты reference-страниц

Тексты страниц — copy deck проекта strategy (`strategy/site/<surface>/copy/<page>.yaml` и
`.<lang>.yaml`), секции — планы `plans/<page>.yaml`; в шаблоне они написаны про шаблон. Со
strategy форк получает свои снимком, без него переписывает под проект в той же форме (валидаторы
strategy — `site_validate.py`, `copydeck.py check`): число и дата текста — факты, тексты — на
каждом языке страницы карты. Композиции страниц (`src/pages/_<page>/`) ставят блоки секций плана
и текстов не держат.

### A.7 Редиректы → `content/redirects.yaml`

Демо-записи удалить. Свои — адреса старого сайта: `{ from, to, status }`, один хоп. `from`
пишется как адрес был — с заглавными, кириллицей, хвостовым слешем и `?query` (`/?p=123`,
`/index.php?id=5`): к одной форме его приводит таблица (rule `content-invariants`).

Два теста ходят по этому файлу и переезжают вместе с ним:
`src/app/middleware/index.server.test.ts` (кейс «адреса … до роутинга» знает демо-адреса
`/old`, `/blog/staraya-zametka` и `/en/blog/old-note` — подставить свои) и
`src/app/middleware/redirects.test.ts` (условие «таблица непуста» — если своих редиректов
нет, файл остаётся с одним комментарием, а условие меняется на «таблица строится»:
пустая таблица валидна).

### A.8 Env-контракт

Источник: `config.md`. Для каждого нового ключа — три места: Zod-схема
`src/shared/config/runtime.ts`, `.env.example`, таблица `docs/reference/deployment.md`
(колонка «в HTML?»). Разметка env не читает: значение, которое должно попасть в HTML, — поле
`src/shared/config/site.ts`, а не env. Таблицу контракта не дублируй в `docs/stack/config.md` —
ссылайся.

Ключи, которые оператор обязан задать на VPS, собери списком для handoff: как минимум
`SITE_URL`, плюс канал доставки формы и `ROBOTS_POLICY` для staging.

### A.9 Прунинг reference-набора

По режиму из Gate-5 — чек-лист `references/prune.md`. Делается **после** того, как
собственные страницы спроектированы: reference-набор до этого момента живой образец.

### A.10 Шаблонная мета

- `README.md` — переписать под проект: что это за сайт, как поднять, команды, ссылки
  на `docs/`. Упоминания «шаблон», «template», «форкни» уходят
- `CONTRIBUTING.md` — про вклад в шаблон; либо переписать под свою команду, либо удалить
- `docs/getting-started.md` — удалить: это путь потребителя шаблона
- `docs/reference/kinship.md`, `scripts/kin-diff.mjs`, `package.json#scripts.kin:diff`
  и строки о них в `README.md`/`CLAUDE.md`/`docs/README.md`/`docs/reference/ecosystem.md`/
  `.claude/skills/smartdev/SKILL.md`/`.claude/skills/plan/references/repo.md` — удалить:
  родство двух канонических шаблонов проекта не касается
- `docs/reference/ecosystem.md` — оставить таблицу «сайт или приложение за логином», соседей,
  флоу и контракты (strategy, infra, registry, handoff), «этот шаблон» переписать на «этот
  сайт»; убрать разделы «Родство с `spa-frontend-template`» и «Шаблон vs проект». Имена
  шаблонов в карте соседей остаются: это происхождение форков
- `docs/research/**` — удалить: исследование, из которого вырос шаблон, не часть проекта;
  вместе с ним — ссылки на него в `.claude/rules/seo-invariants.md`,
  `docs/reference/rendering.md`, `biome.json` (исключение каталога) и
  `src/app/styles/index.css` (комментарий к `source()`)
- `.claude/skills/{init-service,de-template}` — удалить: одноразовые скиллы онбординга
  отработали, а их триггеры («свежий форк») на развёрнутом проекте только мешают.
  Остальные (`smartdev`, `plan`, `stack-deep-dive`, `scaffold`, `content`, `seo-audit`,
  `release`) остаются — это рабочий инструмент проекта
- `.claude/plans/` — без планов шаблона: только `backlog.md` (пустой или со своими задачами);
  планы шаблона — не планы проекта
- `CLAUDE.md` — снять упоминания «шаблон» там, где речь о проекте; правила, команды и
  инварианты остаются: они и есть то, ради чего форк брали
- `SECURITY.md` — контакт и скоуп свои

## Этап B — doc-driven wiring

По stable-записям FSD-карты чейнить `/scaffold`:

- `entities.md` → `/scaffold collection` (сущность с контентом); сущность без контента — вручную по
  rule `fsd-architecture`
- `pages.md` → `/scaffold page` (ru + en) и `/scaffold route` (служебный маршрут)
- `features.md` → `/scaffold feature`
- блоки секций планов `strategy/site/<поверхность>/plans/` → `/scaffold block`

После каждого — `pnpm typecheck && pnpm lint && pnpm steiger` зелёные.

## Финал

```bash
grep -n 'example: true' strategy/facts*.yaml && echo "STOP: демо-факты остались"
grep -rniE 'ssr-frontend-template|@stit/' --include='*.ts' --include='*.astro' --include='*.md' src docs README.md
pnpm check
```

Зелёный `pnpm check`, ни одного демо-факта, а шаблон упоминается только как
происхождение форка (карта соседей в `docs/reference/ecosystem.md`) →
сообщи юзеру: онбординг закрыт, дальше `/smartdev` → `/plan` → `/scaffold` → `/content`.
