#!/bin/sh
# usage: srv.sh start|stop|restart   (env: SITE_URL, ROBOTS_POLICY, PORT, KEEP_ALIVE_TIMEOUT)
P="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-3204}"

case "$1" in
  sync)
    # standalone-сервер не копирует статику сам — делаем это руками (как в Dockerfile).
    mkdir -p "$P/.next/standalone/.next"
    rm -rf "$P/.next/standalone/.next/static" "$P/.next/standalone/public"
    cp -r "$P/.next/static" "$P/.next/standalone/.next/static"
    cp -r "$P/public" "$P/.next/standalone/public"
    ;;
  start)
    cd "$P/.next/standalone" || exit 1
    PORT="$PORT" HOSTNAME="${HOSTNAME:-127.0.0.1}" \
      SITE_URL="${SITE_URL:-http://127.0.0.1:$PORT}" \
      ROBOTS_POLICY="${ROBOTS_POLICY:-index}" \
      RELEASE="${RELEASE:-v0.0.0-spike}" \
      REVALIDATE_SECRET="${REVALIDATE_SECRET:-dev-secret}" \
      KEEP_ALIVE_TIMEOUT="${KEEP_ALIVE_TIMEOUT:-}" \
      node server.js > "$P/server.log" 2>&1 &
    echo $! > "$P/server.pid"
    for _ in $(seq 1 60); do
      if curl -sf "http://127.0.0.1:$PORT/healthz" > /dev/null 2>&1; then echo "up pid=$(cat "$P/server.pid")"; exit 0; fi
      sleep 0.3
    done
    echo "FAILED to start"; tail -20 "$P/server.log"; exit 1
    ;;
  stop)
    if [ -f "$P/server.pid" ]; then kill "$(cat "$P/server.pid")" 2>/dev/null; rm -f "$P/server.pid"; fi
    ;;
esac
