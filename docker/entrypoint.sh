#!/bin/sh
# Штамповка origin: сборка печёт в prerendered-выход плейсхолдер https://__site_origin__,
# здесь он заменяется на SITE_URL контейнера — так один образ едет во все среды, не теряя
# абсолютных canonical/og:url/sitemap.
#
# Только dist/client: on-demand маршруты берут origin из runtime SITE_URL, а в dist/server
# лежит и константа плейсхолдера, по которой конфиг отличает «не задано». HTML на сборке
# не предсжимается — иначе плейсхолдер уедет внутрь .br/.gz. DIST_DIR параметризован,
# чтобы e2e гонял ту же штамповку на локальном dist/.
set -eu

PLACEHOLDER='https://__site_origin__'
CLIENT="${DIST_DIR:-/app/dist}/client"

case "${SITE_URL:-}" in
  "$PLACEHOLDER" | "$PLACEHOLDER"/*)
    echo "[entrypoint] SITE_URL is the build placeholder; set the real origin" >&2
    exit 1
    ;;
  http://* | https://*) ;;
  *)
    echo "[entrypoint] SITE_URL must be an absolute http(s) URL, got '${SITE_URL:-}'" >&2
    exit 1
    ;;
esac
ORIGIN=$(printf '%s' "$SITE_URL" | sed 's|/*$||')

if [ ! -d "$CLIENT" ]; then
  echo "[entrypoint] $CLIENT not found: build output is missing" >&2
  exit 1
fi

find "$CLIENT" -type f \( -name '*.html' -o -name '*.xml' -o -name '*.txt' \) -print0 \
  | xargs -0 -r sed -i "s|$PLACEHOLDER|$ORIGIN|g"

# Остаток в любом файле (css, js, бинарь) — расширение не учтено выше; такой контейнер
# не должен попасть под трафик. Повторный старт (всё уже проштамповано) проходит чисто.
if leftovers=$(grep -rl "$PLACEHOLDER" "$CLIENT"); then
  printf '[entrypoint] placeholder left after stamping:\n%s\n' "$leftovers" >&2
  exit 1
fi
echo "[entrypoint] stamped $PLACEHOLDER -> $ORIGIN in $CLIENT"

exec "$@"
