# ── build ───────────────────────────────────────────────────────────
FROM node:24-alpine AS build

WORKDIR /app
ENV PNPM_HOME=/pnpm CI=1
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
ARG SITE_RENDER_MODE=D
ARG SITE_URL
ENV SITE_RENDER_MODE=$SITE_RENDER_MODE SITE_URL=$SITE_URL
RUN pnpm build

# ── runtime ─────────────────────────────────────────────────────────
FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    SHUTDOWN_TIMEOUT=15 \
    KEEP_ALIVE_TIMEOUT=65 \
    HEADERS_TIMEOUT=70

# adapter-node бандлит всё, что лежит в devDependencies: node_modules в рантайме не нужен.
COPY --from=build --chown=node:node /app/build ./build
COPY --chown=node:node docker/entrypoint.sh /entrypoint.sh

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "build"]
