#!/bin/sh
# Генерация /usr/share/nginx/html/config.js из env-переменных контейнера.
# Запускается nginx-base-образом из /docker-entrypoint.d/ перед стартом nginx.
set -eu

OUT=/usr/share/nginx/html/config.js

cat > "$OUT" <<EOF
window.__APP_CONFIG__ = {
  API_BASE_URL: "${API_BASE_URL:-/api}",
  API_MODE: "${API_MODE:-real}",
  SENTRY_DSN: "${SENTRY_DSN:-}",
  SENTRY_ENVIRONMENT: "${SENTRY_ENVIRONMENT:-production}",
  RELEASE: "${RELEASE:-unknown}"
};
EOF

echo "runtime config injected → $OUT"
