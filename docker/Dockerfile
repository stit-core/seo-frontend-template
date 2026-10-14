# Мажор Node — аргумент сборки: умолчание — Active LTS, новый чётный мажор проверяется сборкой с
# --build-arg NODE_VERSION=<мажор> и приёмкой образа (docs/stack/_templates/dependencies.md § Обновления).
ARG NODE_VERSION=24

# ── pnpm ────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS pnpm

WORKDIR /app
# Стор pnpm — $PNPM_HOME/store: его держит cache-mount между сборками.
ENV PNPM_HOME=/pnpm CI=1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Ровно версия packageManager и без corepack: в Node ≥ 25 его нет.
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm install -g "$(node -p "require('./package.json').packageManager")"

# ── build ───────────────────────────────────────────────────────────
FROM pnpm AS build

# --ignore-scripts: `prepare` → `lefthook install` требует git, а скрипты зависимостей
# сборке не нужны — нативные бинарники приходят optional-пакетами.
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

COPY . .
# Один образ на все среды: без SITE_URL сборка печёт плейсхолдер origin
# (astro.config.ts), entrypoint штампует реальный при старте.
RUN pnpm build

# ── prod-deps ───────────────────────────────────────────────────────
# Выход Astro не self-contained: фреймворк и адаптер сборка встроила в dist/server, а пакеты,
# которые импортируют бандл и обёртка, Node ищет в node_modules. Ставим только dependencies —
# ровно эти импорты (их держит seo:check).
FROM pnpm AS prod-deps

RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --ignore-scripts

# ── runtime ─────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine

WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --chown=node:node --chmod=755 docker/entrypoint.sh /app/docker/entrypoint.sh
COPY --chown=node:node docker/stamp.mjs docker/server.mjs /app/docker/

USER node
EXPOSE 3000

# Shell-форма: порт берётся из env контейнера, а не из константы образа.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/healthz" || exit 1

# entrypoint: env по схеме и настоящий SITE_URL, штамповка плейсхолдера в dist/client.
ENTRYPOINT ["/app/docker/entrypoint.sh"]
# Обёртка вместо прямого entry.mjs: graceful shutdown + keep-alive под Traefik.
CMD ["node", "./docker/server.mjs"]
