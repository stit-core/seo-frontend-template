# Handoff: ресёрч SSR/контент-first шаблона — закрыт 2026-09-16

Итог — `docs/research/ssr/00-synthesis.md` (сводный синтез двух раундов: финалист, единая
таблица измерений, архитектура, вопросы владельцу §10, риски §11, план реализации §12) и его
HTML-версия `00-synthesis.html` (опубликована как артефакт claude.ai,
`https://claude.ai/code/artifact/d7427ee9-4b59-4048-acb3-31a3b9cee7b8`; при обновлении публиковать
с `url`, favicon не менять). Каталог `docs/research/` untracked — коммит и состав коммита решает
владелец.

## Решение

**`ssr-frontend-template` строится на Astro 7 + `@astrojs/node`** (`output: 'static'` с адаптером
`standalone`, вариант C — prerender + штамповка `https://__site_origin__` при старте контейнера,
D — опция для CMS/API). Запасные: Nuxt 4.5 (первый), Next 16.3 (второй); SvelteKit — не
запасной. Обоснование и условия пересмотра — синтез §5. Имя репозитория подтверждено владельцем;
реализацию ведёт Fable по синтезу и отчётам потоков (они написаны как спецификации: точные версии,
листинги конфигов, ловушки с URL).

## Что где

| файл | что |
|---|---|
| `../00-synthesis.md`, `../00-synthesis.html` | сводный синтез (единственный «вход» для реализации) |
| `../01…06-*.md`, `../_sub-*.md` | раунд 1: матрица со старыми весами, **SEO-канон (02)**, перенос стека, **деплой (04)**, дизайн шаблона, spike TanStack Start |
| `brief.md`, `brief-v2.md` | факты об экосистеме; критерии/веса, спецификация spike и таблица измерений |
| `07-landscape-v2.md` | матрица с новыми весами, топ-3, факты зрелости (Cloudflare/Astro, каденс мажоров) |
| `08-spike-astro.md` + `spikes/spike-astro/` | эталонный сайт на Astro: конфиги для переноса, A/C/D с цифрами, 17 подводных камней |
| `09-spike-nuxt.md` + `spikes/spike-nuxt/` | Nuxt 4.5: `routeRules`, Nuxt SEO suite, цена FSD |
| `10-spike-sveltekit.md` + `spikes/spike-sveltekit/` | SvelteKit 2.70: `csr = false`, свой кеш-слой, кросс-находки (boundaries без резолвера, barrel-утечки) |
| `11-spike-next.md` + `spikes/spike-next/` | Next 16.3: контрольная точка React-first (138 КБ JS, честный 404 по рецепту, `views` вместо `pages`) |
| `12-tooling-fsd.md` + `spikes/tooling-lab/` | Steiger/ESLint/Biome/Vitest × `.astro/.svelte/.vue`, FSD-раскладка, конфиги гейта |
| `13-template-v2.md` | дизайн шаблона под не-React: kinship v2, 13 kinds, скиллы, cross-repo |
| `14-content-architecture.md` | референс-архитектура контент-сайта (собран из 14 + 14a): источники и CMS-лицензии, режимы рендера, картинки/шрифты/поиск/формы/аналитика, право РФ, бюджеты, a11y, версии, черновики kinds, инварианты C-1…C-26 |
| `14a-content-gaps.md` | сырой выход потока 14a (секции, вставленные в 14; замеры с RU-машины) |
| `bench/` | мини-бенч «одна страница в пяти фреймворках» (Eleventy, RR8, SolidStart, Qwik) + `measure.sh`, `npmver.py` |
| `prompts/PROMPTS.md`, `prompts/ROUND2-CONTEXT.md` | промпты семи агентов как запускались + общий контекст для них |
| `misc/` | вспомогательные скрипты и выгрузки (HTTP Archive, Web Almanac, llms.txt) |

Исходники spike'ов сохранены без `node_modules` и выходов сборки: перед запуском —
`pnpm install --frozen-lockfile`; порты astro 3201 · nuxt 3202 · sveltekit 3203 · next 3204.

## Как продолжать

1. Владелец отвечает на вопросы синтеза §10 (27 пунктов, у каждого есть рекомендация;
   блокирующих нет — можно принять рекомендации целиком) и решает судьбу коммита `docs/research/`.
2. Фаза 0 плана (§12): отдельный PR в `project-infra-template-compose` (CrowdSec acquisition +
   `rdns`/`seo-bots-whitelist`, убрать `sslRedirect`, `compress`, `www-to-apex`, `retry`,
   `staging-noindex`, `staging-auth`, `accessLog.filePath` + `X-Request-Id`, `Makefile bump --wait`).
   Опционально в этом репо: проверить и починить `eslint-plugin-boundaries` без
   `settings['import/resolver'].typescript` и `@eslint/js@10` при `eslint@9`.
3. Фазы 1–7 (§12) — новый репозиторий `ssr-frontend-template` (fork SPA-шаблона, перенос
   идентичного ядра обвязки и токен-слоя, конфиги из `08-spike-astro.md` §3 и `12-tooling-fsd.md`,
   архитектура по `14-content-architecture.md`, обвязка по `13-template-v2.md`); каждая фаза
   заканчивается гейтом из таблицы плана.
4. Если понадобится доисследовать: агенты запускаются на Opus по `prompts/PROMPTS.md` (≤ 5
   одновременно), scratchpad восстанавливается из этого каталога (см. шапку `PROMPTS.md`).

## Что не проверено (сводно; полные списки — в отчётах)

- `pnpm.supportedArchitectures: { libc: ['musl'] }` для `sharp` (−18 МБ образа) и
  `experimental.isrFlushToDisk` у Next — не гонялись (11 §20).
- Поведение spike'ов **за живым Traefik** (сжатие, буферизация стрима, `X-Robots-Tag` через
  `customResponseHeaders`) — требует стенда; все spike'и мерились напрямую.
- Недоступность `googletagmanager.com`/`google-analytics.com` и доступность `api.telegram.org`
  измерены с одной RU-машины — перепроверить с VPS заказчика (14 §7).
- Позиция РКН по cookie как ПДн — первоисточник на домене РКН не найден; нормы 265-ФЗ с
  переходными сроками 01.09.2027 — по вторичным источникам (14 §7).
- `experimentalDisableStreaming` у `@astrojs/node` доезжает до манифеста, но эффект curl'ом не
  виден (08 §7.12).
