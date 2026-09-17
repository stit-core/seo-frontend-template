#!/usr/bin/env bash
# Приёмка фазы 1 главной сессией: образ, штамповка, curl-проверки, дренаж.
set -uo pipefail
REPO=/home/mm/git/stit-core/ssr-frontend-template
IMG=ssr-template-accept
PORT=${PORT:-3212}
cd "$REPO"

echo "== docker build =="
docker build -f docker/Dockerfile --secret id=npmrc,src="$HOME/.npmrc" -t "$IMG" . 2>&1 | tail -4
docker images "$IMG" --format 'image size: {{.Size}}'

echo "== run without SITE_URL (must fail fast) =="
docker run --rm --name ssr-accept-nosite "$IMG" >"$REPO/../.accept-nosite.log" 2>&1
echo "exit=$?"; tail -3 "$REPO/../.accept-nosite.log"; rm -f "$REPO/../.accept-nosite.log"

echo "== run with SITE_URL=https://demo.example =="
CID=$(docker run -d --rm --name ssr-accept -p "$PORT:3000" -e SITE_URL=https://demo.example -e ROBOTS_POLICY=index "$IMG")
for _ in $(seq 1 40); do curl -sf "http://127.0.0.1:$PORT/healthz" >/dev/null && break; sleep 0.25; done
docker logs "$CID" 2>&1 | head -4

for p in / /en /xx /healthz /en/ /index.html /404; do
  printf '%-12s ' "$p"
  curl -s -o /dev/null -w '%{http_code} redirect=%{redirect_url} size=%{size_download}B ttfb=%{time_starttransfer}s\n' "http://127.0.0.1:$PORT$p"
done

echo "== Googlebot: h1 count / script tags =="
curl -s -A Googlebot "http://127.0.0.1:$PORT/" | grep -c '<h1'
curl -s -A Googlebot "http://127.0.0.1:$PORT/" | grep -oE '<script[^>]*>' | sort | uniq -c || true

echo "== placeholder left in /app/dist/client (must be 0; dist/server keeps it by design) =="
docker exec "$CID" sh -c 'grep -rl __site_origin__ /app/dist/client | wc -l'

echo "== head bits =="
curl -s "http://127.0.0.1:$PORT/" | grep -oE '<html[^>]*>|<link rel="canonical"[^>]*>|<meta name="robots"[^>]*>' | head -5

echo "== headers / and /healthz =="
curl -sI "http://127.0.0.1:$PORT/" | grep -iE '^(cache-control|etag|x-robots-tag|content-type|keep-alive)' || true
curl -sI "http://127.0.0.1:$PORT/healthz" | grep -iE '^(cache-control|x-robots-tag|x-request-id)' || true

echo "== TTFB median of 20 (s) =="
for _ in $(seq 1 20); do curl -s -o /dev/null -w '%{time_starttransfer}\n' "http://127.0.0.1:$PORT/"; done | sort -n | sed -n '10p'

echo "== staging mode: ROBOTS_POLICY=noindex on on-demand route =="
docker stop "$CID" >/dev/null
CID=$(docker run -d --rm --name ssr-accept -p "$PORT:3000" -e SITE_URL=https://staging.example -e ROBOTS_POLICY=noindex "$IMG")
for _ in $(seq 1 40); do curl -sf "http://127.0.0.1:$PORT/healthz" >/dev/null && break; sleep 0.25; done
curl -sI "http://127.0.0.1:$PORT/healthz" | grep -i 'x-robots-tag' || echo "no X-Robots-Tag on /healthz"

echo "== docker stop timing =="
START=$(date +%s%N)
docker stop "$CID" >/dev/null
END=$(date +%s%N)
echo "docker stop: $(( (END - START) / 1000000 )) ms"
echo "== done =="
