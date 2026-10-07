#!/usr/bin/env sh
# Приёмка собранного образа до пуша в registry: отказ без SITE_URL за конечное время, штамповка
# origin, статусы ключевых маршрутов, canonical, CSP, robots и карта, контур staging, дренаж по
# SIGTERM; заголовки и TTFB — печать без порога.
# Использование: pnpm accept:image <image> [port]
set -u

IMAGE=${1:-}
PORT=${2:-3211}
NAME=site-accept-$$
ORIGIN=https://accept.example
# Отказ без SITE_URL — доли секунды; дольше — контейнер поднялся без origin и ждёт трафика.
REFUSE_S=20
# Умолчание SHUTDOWN_TIMEOUT_MS обёртки: дренаж обязан уложиться в него, docker stop ждёт дольше.
DRAIN_MS=15000

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

running() { [ "$(docker inspect -f '{{.State.Running}}' "$NAME" 2>/dev/null)" = "true" ]; }
exit_code() { docker inspect -f '{{.State.ExitCode}}' "$NAME"; }
# Миллисекунды — от Node: у date в macOS нет %N.
now_ms() { node -e 'process.stdout.write(String(Date.now()))'; }

echo "== старт без SITE_URL: отказ за $REFUSE_S с =="
docker run -d --name "$NAME" "$IMAGE" >/dev/null || exit 1
i=0
while running && [ "$i" -lt $((REFUSE_S * 4)) ]; do
  i=$((i + 1))
  sleep 0.25
done
if running; then
  fail "контейнер без SITE_URL работает дольше $REFUSE_S с"
elif [ "$(exit_code)" = "0" ]; then
  fail "контейнер без SITE_URL вышел с кодом 0"
elif docker logs "$NAME" 2>&1 | grep -q 'SITE_URL'; then
  ok "отказ без SITE_URL: код $(exit_code), лог называет SITE_URL"
else
  fail "контейнер без SITE_URL упал, но лог не называет SITE_URL"
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

# CSP статики адаптер читает из dist/_headers.json по пути сборки: в образе он обязан совпасть.
for path in / /net-takogo-puti; do
  curl -sI "http://127.0.0.1:$PORT$path" | grep -qi "^content-security-policy: .*frame-ancestors 'none'" &&
    ok "CSP на $path" || fail "$path без CSP"
done

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
# Без --rm: после docker stop нужны код выхода и лог.
docker run -d --name "$NAME" -p "$PORT:3000" \
  -e SITE_URL="$ORIGIN" -e ROBOTS_POLICY=noindex "$IMAGE" >/dev/null || exit 1
wait_healthz || {
  fail "staging-профиль не поднялся"
  exit 1
}
curl -s "http://127.0.0.1:$PORT/robots.txt" | grep -q 'Disallow: /' &&
  ok "robots.txt закрывает сайт" || fail "staging: robots.txt не закрыт"
curl -sI "http://127.0.0.1:$PORT/" | grep -qi '^x-robots-tag: noindex, nofollow' &&
  ok "X-Robots-Tag на странице сборки" || fail "staging: у страницы сборки нет X-Robots-Tag"

# SIGTERM доходит до node, только если entrypoint отдал ему процесс (exec): иначе PID 1 — оболочка,
# сигнал теряется, и docker stop добивает контейнер SIGKILL (код 137) по истечении -t.
echo "== дренаж: SIGTERM до node, выход 0 быстрее $DRAIN_MS мс =="
start=$(now_ms)
docker stop -t $((DRAIN_MS / 1000 + 5)) "$NAME" >/dev/null 2>&1
ms=$(($(now_ms) - start))
if ! docker logs "$NAME" 2>&1 | grep -q '\[server\] SIGTERM'; then
  fail "дренаж: SIGTERM не дошёл до node ($ms мс, код $(exit_code))"
elif [ "$(exit_code)" != "0" ] || [ "$ms" -ge "$DRAIN_MS" ]; then
  fail "дренаж: $ms мс, код $(exit_code) — ждали 0 быстрее $DRAIN_MS мс"
else
  ok "дренаж: $ms мс, код 0"
fi

echo
if [ "$fails" -gt 0 ]; then
  echo "приёмка образа: $fails проверок не прошло"
  exit 1
fi
echo "приёмка образа: всё зелёное"
