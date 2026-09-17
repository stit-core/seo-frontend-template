# Roadmap

Единый план активной работы. Любое содержательное изменение идёт через секцию
здесь (skill `/plan`). План переживает `/clear`.

## Active

### Сборка v1 по build-brief

Вход сессии — `docs/research/NEXT-SESSION.md` (цикл фазы, приёмка, ревью, известные
проблемы среды). Спецификация — `docs/research/BUILD-BRIEF.md`; решения владельца —
`docs/research/ssr/DECISIONS.md`; отчёты принятых фаз — `docs/research/reports/phase-N.md`;
итог ресёрча — `docs/research/ssr/00-synthesis.md` (§12 — план фаз). Исполнение: Fable-агент
по одной фазе за запуск, приёмка главной сессией (brief §8), после приёмки — коммит + push
в `main`.

- [x] Фаза 1 — фундамент: прунинг SPA-рантайма, `astro.config.ts`, гейт (`astro check`,
  Biome + Prettier для `.astro`, ESLint 10 + `boundaries` с резолвером, Steiger, Vitest 5,
  Playwright на prod-сборке, size-limit, lefthook, commitlint), `.gate-fixtures/` + `check:gate`,
  Docker (три стадии, штамповка `SITE_URL`, `server.mjs`), `/healthz`, kinship + `kin:diff`,
  правила `fsd-architecture`/`env-local`/`tests-pipeline`/`shared-ui`, `CLAUDE.md`, `README.md`,
  `docs/reference/deployment.md`
- [x] Фаза 2 — контент-слой: `entities/post` (ru/en, `translationKey`, `draft`), блог (список,
  пост, пагинация, теги), `content/redirects.yaml`, `check:content`, `check:links`,
  правило `content-invariants`
- [x] Фаза 3 — рендер: prerender per route, `now`, `X-Robots-Tag`/`Cache-Control` на on-demand,
  рецепт D в `docs/reference/rendering.md`, правило `render-safety`
- [x] Фаза 4 — SEO-слой: `shared/seo/*`, `robots.txt`/`sitemap.xml`/`rss.xml`, JSON-LD + Zod,
  `widgets/breadcrumbs`, `e2e/seo.spec.ts`, `seo:check`, правило `seo-invariants`
- [x] Фаза 5 — reference-слайсы и визуальный уровень: about, contacts + spasibo (форма без JS,
  `FORM_DELIVERY`), legal/privacy, 500, тема (единственный остров), картинки build-time,
  аналитика после idle, e2e forms/a11y
- [x] Фаза 6 — обвязка: `docs/stack` 12 kinds + `_templates`, скиллы (`smartdev`, `init-service`,
  `stack-deep-dive`, `de-template`, `scaffold`, `release`, `seo-audit`, `content`),
  `docs/reference/*`, `getting-started.md`, финальные `CLAUDE.md`/`README.md`
- [ ] Фаза 7 — in-repo часть: `docs/reference/ecosystem.md`, sweep «6 → 7», handoff-документ
  для infra (`compose/site.yml`, staging `basicAuth` + `X-Robots-Tag`, дефекты infra) —
  cross-repo правки (`project-infra-template-compose`, `corp-infra-template`,
  `spa-frontend-template`, `stit-public`) владелец ведёт отдельными сессиями

## Backlog

- Нормализация регистра URL одним 308 (канон I-5) — middleware; сейчас URL чувствительны
  к регистру, canonical = реальный адрес
- Cross-repo часть фазы 7 (`project-infra-template-compose`: `compose/site.yml`, дефекты infra;
  `corp-infra-template/docs/ecosystem.md`; `spa-frontend-template`; `stit-public`) — по
  handoff-документу фазы 7, отдельными сессиями в тех репо
