#!/usr/bin/env sh
# Приёмка собранного образа до пуша в registry: отказ без SITE_URL, штамповка origin,
# статусы ключевых маршрутов, canonical, robots и карта, контур staging; заголовки, TTFB и
# дренаж — печать без порога.
# Использование: pnpm accept:image <image> [port]
set -u

IMAGE=${1:-}
PORT=${2:-3211}
NAME=site-accept-$$
ORIGIN=https://accept.example

if [ -z "$IMAGE" ]; then
  echo "usage: pnpm accept:image <image> [port]" >&2
  exit 2
fi

fails=0
fail() {
  echo "  ✗ $1"
  fails=$((fails + 1))
}
ok() { echo "  ✓ $1"; }

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM

status() { curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT$1"; }

wait_healthz() {
  i=0
  while [ "$i" -lt 60 ]; do
    if curl -sf "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1; then return 0; fi
    i=$((i + 1))
    sleep 0.25
  done
  return 1
}

echo "== образ =="
docker image inspect "$IMAGE" >/dev/null 2>&1 || {
  echo "нет образа $IMAGE — собери его сначала" >&2
  exit 2
}
docker images "$IMAGE" --format '  размер: {{.Size}}'

echo "== старт без SITE_URL: обязан упасть =="
if docker run --rm --name "$NAME" "$IMAGE" >/dev/null 2>&1; then
  fail "контейнер поднялся без SITE_URL"
else
  ok "fail-fast без SITE_URL"
fi
cleanup

echo "== прод-профиль ($ORIGIN) =="
docker run -d --rm --name "$NAME" -p "$PORT:3000" \
  -e SITE_URL="$ORIGIN" -e ROBOTS_POLICY=index "$IMAGE" >/dev/null || exit 1
wait_healthz || {
  docker logs "$NAME" 2>&1 | tail -5
  fail "healthz не ответил"
  exit 1
}

for path in / /en /about /contacts; do
  code=$(status "$path")
  [ "$code" = "200" ] && ok "$path → 200" || fail "$path → $code (ждали 200)"
done
code=$(status /net-takogo-puti)
[ "$code" = "404" ] && ok "несуществующий путь → 404" || fail "несуществующий путь → $code"

left=$(docker exec "$NAME" sh -c 'grep -rl __site_origin__ /app/dist/client 2>/dev/null | wc -l' | tr -d ' ')
[ "$left" = "0" ] && ok "плейсхолдер origin вычищен из dist/client" || fail "плейсхолдер остался в $left файлах"

canonical=$(curl -s "http://127.0.0.1:$PORT/" | grep -o 'rel="canonical" href="[^"]*"' | head -1)
case "$canonical" in
*"$ORIGIN"*) ok "canonical на runtime origin: $canonical" ;;
*) fail "canonical не на $ORIGIN: ${canonical:-нет}" ;;
esac

scripts=$(curl -s -A Googlebot "http://127.0.0.1:$PORT/" | grep -c '<script' || true)
echo "  тегов <script> на главной (Googlebot): $scripts"
robots=$(curl -s "http://127.0.0.1:$PORT/robots.txt")
case "$robots" in
*"Disallow: /"*) fail "robots.txt в прод-профиле закрывает сайт" ;;
*) ok "robots.txt открыт, Sitemap: $(printf '%s' "$robots" | grep -i '^Sitemap:' | head -1)" ;;
esac
locs=$(curl -s "http://127.0.0.1:$PORT/sitemap.xml" | grep -c '<loc>' || true)
[ "$locs" -gt 0 ] && ok "sitemap.xml: $locs URL" || fail "sitemap.xml пуст"

echo "== заголовки =="
curl -sI "http://127.0.0.1:$PORT/" | grep -iE '^(cache-control|etag|content-type)' | sed 's/^/  /'
curl -sI "http://127.0.0.1:$PORT/healthz" | grep -iE '^(cache-control|x-request-id)' | sed 's/^/  /'

echo "== TTFB главной, медиана 20 =="
i=0
while [ "$i" -lt 20 ]; do
  curl -s -o /dev/null -w '%{time_starttransfer}\n' "http://127.0.0.1:$PORT/"
  i=$((i + 1))
done | sort -n | sed -n '10p' | sed 's/^/  медиана: /'

echo "== контур staging (ROBOTS_POLICY=noindex) =="
cleanup
docker run -d --rm --name "$NAME" -p "$PORT:3000" \
  -e SITE_URL="$ORIGIN" -e ROBOTS_POLICY=noindex "$IMAGE" >/dev/null || exit 1
wait_healthz || {
  fail "staging-профиль не поднялся"
  exit 1
}
curl -s "http://127.0.0.1:$PORT/robots.txt" | grep -q 'Disallow: /' &&
  ok "robots.txt закрывает сайт" || fail "staging: robots.txt не закрыт"
curl -sI "http://127.0.0.1:$PORT/" | grep -qi '^x-robots-tag: noindex, nofollow' &&
  ok "X-Robots-Tag на странице сборки" || fail "staging: у страницы сборки нет X-Robots-Tag"

echo "== дренаж (docker stop) =="
start=$(date +%s%N)
docker stop "$NAME" >/dev/null 2>&1
echo "  $(((($(date +%s%N) - start)) / 1000000)) мс"

echo
if [ "$fails" -gt 0 ]; then
  echo "приёмка образа: $fails проверок не прошло"
  exit 1
fi
echo "приёмка образа: всё зелёное"
