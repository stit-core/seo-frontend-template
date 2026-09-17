#!/bin/sh
set -eu

# Режим C: в prerendered HTML на сборке уехал плейсхолдер — штампуем его
# реальным origin один раз при старте контейнера и выбрасываем предсжатые
# копии HTML (в них остался бы старый origin); sirv отдаст их несжатыми,
# HTML жмёт Traefik.
if [ -d /app/build/prerendered ] && [ -n "${SITE_URL:-}" ]; then
  origin=$(printf '%s' "$SITE_URL" | sed 's#/*$##')
  if grep -rql '__SITE_ORIGIN__' /app/build/prerendered 2>/dev/null; then
    start=$(date +%s%N)
    grep -rl '__SITE_ORIGIN__' /app/build/prerendered \
      | xargs sed -i "s#https://__SITE_ORIGIN__#${origin}#g"
    find /app/build/prerendered -name '*.html.br' -delete
    find /app/build/prerendered -name '*.html.gz' -delete
    end=$(date +%s%N)
    echo "stamped SITE_ORIGIN=${origin} in $(( (end - start) / 1000000 ))ms"
  fi
fi

exec "$@"
