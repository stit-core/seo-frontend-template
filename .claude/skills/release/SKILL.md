---
name: release
description: Запушить новую версию образа SPA в registry одной процедурой (один nginx-образ; runtime config через env контейнера) и передать инфра-админу handoff. Активируй когда пользователь говорит "релиз", "запушим версию", "сделай release vX.Y.Z", "/release".
---

# Skill: release

Канонический release-флоу фронта. **Зона ответственности этого репо: код →
image в registry. На STOP — всё.** Build локальный, push в
`<registry>/<org>/frontend` под одним `vX.Y.Z`-тегом (registry-путь — из
`docs/stack/service.md § Идентичность`).

**Один образ.** Build `node → nginx` (см. `docs/reference/deployment.md`);
среда конфигурируется на старте контейнера через env (`/config.js` →
`window.__APP_CONFIG__`) — образ один на все env.

Дальше — **handoff** в `<org>/infra`: rollout выполняется там
(`make bump SVC=frontend TAG=<v>` — правит `FRONTEND_TAG` в `.env` VPS +
force-recreate). Этот шаг здесь не выполняется — скилл печатает
INFRA-HANDOFF-блок, оператор (или агент в `<org>/infra`) применяет его.

## Когда применять

- «Релизим v1.2.3» / «Запушь новую версию» / "/release"
- После закрытия задачи и зелёного `pnpm check`, когда юзер сказал «пора катить»

## Когда НЕ применять

- «Собери image локально для теста» → `docker buildx build --load -t spa-local .`
- Пуш feature-веточного билда → preflight отвергает не-main
- Юзер не озвучил OK на релиз → STOP, спроси

## Pre-flight (BEFORE команд)

- [ ] Юзер явно сказал OK на релиз (тег + push — действие видимое вне репо)
- [ ] Ветка `main`, working tree clean
- [ ] `pnpm check` зелёный. Нет — STOP → чинить, не релизить
- [ ] Юзер знает версию (semver-bump по уровню изменений) — не угадывай
- [ ] Оператор залогинен в registry (`docker login <host>` — вне процесса,
      не делай сам)

## Шаги

1. **Тег**: `git tag vX.Y.Z && git push origin vX.Y.Z` (по явному OK).
2. **Build+push**:
   ```bash
   docker buildx build -t <registry>/<org>/frontend:vX.Y.Z --push .
   ```
3. **INFRA-HANDOFF** — напечатать блок:
   ```
   === INFRA HANDOFF · <org>/frontend vX.Y.Z ===
   WHAT:   новый образ <registry>/<org>/frontend:vX.Y.Z
   ACTION: в <org>/infra: make bump SVC=frontend TAG=vX.Y.Z
   ENV:    <новые runtime-env ключи, если появились; иначе "—">
   RISK:   <осознанные риски отката/совместимости; иначе "—">
   ===
   ```
   Новые runtime-ключи берутся из `docs/stack/config.md § Runtime config
   keys` — если контракт env расширился, инфра-админ должен дописать их в
   `.env` VPS до бампа.

## Что НЕ делать

- ❌ Деплой-команды чужих репо (`make ship`, `make bump`, ssh) отсюда —
  зона `<org>/infra`
- ❌ `:latest`/`:edge`-теги — только `vX.Y.Z` или `<sha>`
- ❌ Тег без зелёного `pnpm check` или с грязным деревом
