# ── build ───────────────────────────────────────────────────────────
FROM node:24-alpine AS build

WORKDIR /app
ENV PNPM_HOME=/pnpm CI=1
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .
# A — SITE_URL зашивается на сборке; C — плейсхолдер + штамповка в entrypoint;
# D — origin читается из env на каждый рендер, значение сборки не важно.
ARG SPIKE_VARIANT=C
ARG SITE_URL=https://__site_origin__
ENV SPIKE_VARIANT=${SPIKE_VARIANT} SITE_URL=${SITE_URL}
RUN pnpm build

# ── prod-deps ───────────────────────────────────────────────────────
# Выход Astro не self-contained: entry.mjs импортит astro/react/react-dom/zod,
# а /_image — sharp. Ставим только dependencies.
FROM node:24-alpine AS prod-deps

WORKDIR /app
ENV PNPM_HOME=/pnpm CI=1
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod
# Build-time машинерия, которую тянет сам `astro`, но которая не нужна рантайму.
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
    PORT=3000 \
    SITE_URL=https://__site_origin__

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --chown=node:node docker/entrypoint.sh docker/server.mjs /app/docker/

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

ENTRYPOINT ["/app/docker/entrypoint.sh"]
# Обёртка вместо прямого entry.mjs: graceful shutdown + keep-alive под Traefik.
CMD ["node", "./docker/server.mjs"]
