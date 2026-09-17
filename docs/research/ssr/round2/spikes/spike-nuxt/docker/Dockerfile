# ── build ───────────────────────────────────────────────────────────
FROM node:24-alpine AS build

WORKDIR /app
ENV PNPM_HOME=/pnpm CI=1
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .
# Пресет фиксируем явно: он не должен зависеть от автодетекта окружения.
ENV NITRO_PRESET=node-server
ARG RENDER_MODE=swr
ENV RENDER_MODE=$RENDER_MODE
RUN pnpm build \
 # sharp трассируется под glibc и musl сразу — в alpine-образе нужен только musl.
 && rm -rf .output/server/node_modules/@img/sharp-libvips-linux-x64 \
           .output/server/node_modules/@img/sharp-linux-x64 \
 && find .output -name '*.map' -delete

# ── runtime ─────────────────────────────────────────────────────────
FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    NITRO_SHUTDOWN_TIMEOUT=15000

COPY --from=build --chown=node:node /app/.output ./.output

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

CMD ["node", ".output/server/index.mjs"]
