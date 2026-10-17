# Мини-репо check:prose

Проза ссылается на то, что есть в репо, и на то, чего нет: каждая мёртвая ссылка — строка `expected.json`.

- Путь от корня: `docs/guide.md` есть, `docs/net.md` — нет; от каталога документа — `references/a.md` в
  `.claude/skills/demo/SKILL.md`.
- Слой FSD — от `src/`: `pages/about.astro` есть, `widgets/net-bloka` — нет; модуль без расширения — `pages/healthz`;
  импорт — `@/pages/about.astro`, `@/shared/net-segmenta` — нет.
- Перечень — каждое имя: `docs/{guide,net-perechnya}.md`; glob — хоть один файл: `src/pages/*.astro` есть,
  `docs/*.txt` — нет.
- Артефакт стека `docs/stack/service.md` — по форме `docs/stack/_templates/service.md`; у `docs/stack/routing.md` формы
  нет.
- Не ссылки: плейсхолдер `src/entities/<name>/content/`, путь соседа `../strategy/site/`, адрес `/blog/x`.
- Скрипты: `pnpm check` есть, `pnpm kin:diff` — нет; `pnpm exec x` — команда pnpm.
- Скиллы: `/demo` есть, `/net-takogo` — нет; skill `demo`; встроенная команда `/clear`, корень `/tmp`.
- Адрес сайта — не скилл: `/about`, `/healthz`, `/en` (локаль), `/old` (переезд); `/net-adresa` — ни то ни другое.
- Правила: rule `demo` есть, rule `net-pravila` — нет; правила `demo`, `net-v-perechne` и `docs`.
