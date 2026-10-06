# ── build ───────────────────────────────────────────────────────────
FROM node:24-alpine AS build

WORKDIR /app
ENV PNPM_HOME=/pnpm CI=1
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

COPY package.json pnpm-lock.yaml .npmrc ./
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
# Выход Astro не self-contained: entry.mjs импортит astro/zod, /_image — sharp.
# Ставим только dependencies.
FROM node:24-alpine AS prod-deps

WORKDIR /app
ENV PNPM_HOME=/pnpm CI=1
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --ignore-scripts
# Build-машинерия, которую `astro` тянет в dependencies, но которая не нужна рантайму
# (alpine ставит обе libc-вариации нативных бинарников; рантайму нужна только musl).
RUN rm -rf \
      node_modules/.pnpm/@rolldown+binding-linux-x64-gnu* \
      node_modules/.pnpm/@img+sharp-libvips-linux-x64* \
      node_modules/.pnpm/@img+sharp-linux-x64* \
      node_modules/.pnpm/lightningcss-linux-x64-gnu* \
      node_modules/.pnpm/@astrojs+compiler-binding-linux-x64-gnu* \
      node_modules/.pnpm/@bruits+satteri-linux-x64-gnu* \
      node_modules/.pnpm/@types+node* \
      node_modules/.pnpm/caniuse-lite* \
      node_modules/.pnpm/prismjs*

# ── runtime ─────────────────────────────────────────────────────────
FROM node:24-alpine

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
