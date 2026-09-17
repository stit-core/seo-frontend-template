#!/bin/sh
set -e

# Пререндер знает только плейсхолдер, подставленный на билде: абсолютные URL в
# <head>, JSON-LD и RSC-пейлоаде фиксируются в момент сборки. Штампуем их
# origin'ом контейнера — один образ едет по всем средам.
: "${SITE_URL:?SITE_URL is required}"
PLACEHOLDER="https://site-origin.invalid"
SITE_URL="${SITE_URL%/}"

if [ "$SITE_URL" != "$PLACEHOLDER" ]; then
  grep -rl "$PLACEHOLDER" /app/.next/server/app 2>/dev/null \
    | xargs -r sed -i "s|$PLACEHOLDER|$SITE_URL|g"
fi

exec "$@"
