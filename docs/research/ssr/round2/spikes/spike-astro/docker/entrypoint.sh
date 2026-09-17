#!/bin/sh
# Вариант C: на сборке в prerendered-выход зашит плейсхолдер `https://__site_origin__`,
# при старте контейнера он заменяется на реальный SITE_URL. Так один образ
# едет во все среды, не теряя абсолютных canonical/og:url/sitemap.
#
# Инварианты: HTML на сборке НЕ предсжимается (иначе плейсхолдер уедет внутрь .br/.gz);
# dist/server штампуется тоже — там лежит astro-config-digest с `site`.
set -eu

: "${SITE_URL:?SITE_URL is required}"
PLACEHOLDER='https://__site_origin__'
ORIGIN="${SITE_URL%/}"

if [ "$ORIGIN" != "$PLACEHOLDER" ]; then
  start=$(date +%s%N)
  count=$(
    find /app/dist -type f \( -name '*.html' -o -name '*.xml' -o -name '*.txt' -o -name '*.mjs' \) \
      -exec grep -l "$PLACEHOLDER" {} + 2>/dev/null | tee /tmp/stamp.list | wc -l
  )
  if [ "$count" -gt 0 ]; then
    xargs -r sed -i "s|$PLACEHOLDER|$ORIGIN|g" < /tmp/stamp.list
  fi
  end=$(date +%s%N)
  echo "[entrypoint] stamped $count files in $(( (end - start) / 1000000 )) ms: $PLACEHOLDER -> $ORIGIN"
fi

exec "$@"
