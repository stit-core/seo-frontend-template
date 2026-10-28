# Профиль репо для /plan — seo-frontend-template

- **Роль:** сервис — Astro SEO-сайт (`<org>/site`). Работа приходит фазой программы из хаба
  `<org>/infra` (`parent: infra:<slug>`) или прямым заходом. Итог — образ в registry (`/release`);
  выкатка тега — только из хаба (`make bump SVC=site`).
- **Гейт перед «готово»:** `pnpm check` (состав — rule `tests-pipeline` § Gate).
- **Проверка планов:** `pnpm plan:check` (входит в `pnpm check`; pre-commit проверяет, когда
  меняется `.claude/plans/`).
- **Сводка планов:** `pnpm plan:check --summary`.
- **Типовые проверки шагов:** `pnpm vitest run <путь>` → passed · `pnpm check:content` → OK ·
  `pnpm build` → собрано · `pnpm check:links` → без битых ссылок · `pnpm seo:check` → OK ·
  `pnpm test:http` → passed (после build) · `pnpm test:e2e` → passed (браузерный набор) ·
  `pnpm check` → зелёный.
- **Handoff:** в хаб `<org>/infra` — новый образ, runtime-env и требования к edge сервиса `site` (их
  печатает `/release`, контракт — `docs/reference/infra-handoff.md`); в `<org>/strategy` — расхождение с
  FSD-картой (карта правится только там, её скиллами).
- **Разбор падений:** отдельного скилла нет — сначала воспроизводящий тест, потом фикс.
- **До плана выясни:**
  - какая stable-запись FSD-карты (`<org>/strategy`, `docs/projects/<slug>/fsd/<surface>/`)
    описывает задачу; нет записи — это работа strategy (`/fsd-deep-dive`), а не этого репо;
  - где исполняется код: сборка, запрос или остров (`render-safety`) — и не уезжает ли секрет в клиент;
  - контент: коллекция, схема, переводы и редиректы (`content-invariants`, `/content`);
  - SEO: canonical, hreflang, JSON-LD, robots/sitemap (`seo-invariants`);
  - формы: без JS, антиспам, согласие на обработку ПДн (`forms-antispam`);
  - env (`SITE_URL`, runtime-ключи), новая зависимость — запись в `docs/stack/dependencies.md`.
