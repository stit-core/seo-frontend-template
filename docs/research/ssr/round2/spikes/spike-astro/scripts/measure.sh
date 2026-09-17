#!/usr/bin/env bash
# Батарея измерений spike: размеры HTML, TTFB, статусы, заголовки, RSS процесса.
# usage: measure.sh <base-url> <server-pid> <label>
set -uo pipefail
BASE="${1:-http://127.0.0.1:3201}"
PID="${2:-}"
LABEL="${3:-run}"

hr() { printf '\n== %s ==\n' "$1"; }

hr "HTML размеры (raw / gzip -9)"
for u in / /blog /blog/kanon-canonical /about /contact /now /en; do
  raw=$(curl -s "$BASE$u" | wc -c)
  gz=$(curl -s "$BASE$u" | gzip -9c | wc -c)
  printf '%-24s raw=%-8s gzip=%-7s\n' "$u" "$raw" "$gz"
done

hr "Статусы"
for u in /old /blog/net-takogo /xx/ /xx /about/ /about.html /index.html /blog/ /en /healthz /robots.txt /sitemap.xml /sitemap-index.xml /rss.xml; do
  printf '%-24s ' "$u"
  curl -s -o /dev/null -w '%{http_code} -> %{redirect_url}\n' "$BASE$u"
done

hr "TTFB медиана/мин/p90 (20 запросов)"
for u in / /blog/kanon-canonical /now /healthz /rss.xml /_astro-css; do
  target="$u"
  if [ "$u" = "/_astro-css" ]; then
    css=$(curl -s "$BASE/" | grep -o '/_astro/[^"]*\.css' | head -1)
    target="$css"
  fi
  vals=()
  for _ in $(seq 20); do
    t=$(LC_ALL=C curl -s -o /dev/null -w "%{time_starttransfer}" "$BASE$target")
    vals+=("$t")
  done
  printf '%-24s ' "$target"
  printf '%s\n' "${vals[@]}" | LC_ALL=C sort -g | LC_ALL=C awk '{a[NR]=$1} END {printf "median=%.2fms min=%.2fms p90=%.2fms max=%.2fms\n", a[int(NR/2)+1]*1000, a[1]*1000, a[int(NR*0.9)]*1000, a[NR]*1000}'
done

hr "Заголовки (GET, не HEAD)"
for u in / /now /healthz; do
  echo "--- $u"
  curl -s -D - -o /dev/null "$BASE$u" | grep -iE '^(cache-control|etag|content-encoding|content-type|x-robots|x-cache|vary|last-modified)'
done
css=$(curl -s "$BASE/" | grep -o '/_astro/[^"]*\.css' | head -1)
echo "--- $css"
curl -s -D - -o /dev/null "$BASE$css" | grep -iE '^(cache-control|etag|content-encoding|content-type)'

hr "Сжатие (Accept-Encoding: gzip, br)"
for u in / /now; do
  printf '%-10s ' "$u"
  curl -s -H 'Accept-Encoding: gzip, br, deflate' -D - -o /dev/null "$BASE$u" | grep -ci 'content-encoding' | sed 's/^0$/нет content-encoding/;s/^[1-9].*/есть/'
done

hr "Googlebot"
curl -s -A 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' "$BASE/blog/kanon-canonical" > /tmp/gbot.html
echo "байт: $(wc -c < /tmp/gbot.html)"
grep -c '<h1' /tmp/gbot.html | sed 's/^/h1: /'
grep -o 'Канон canonical' /tmp/gbot.html | head -1 | sed 's/^/title-текст: /'
grep -c 'Structured data описывает' /tmp/gbot.html | sed 's/^/текст тела поста: /'

hr "SEO-разметка в сыром HTML /blog/kanon-canonical"
curl -s "$BASE/blog/kanon-canonical" > /tmp/post.html
for pat in '<link rel="canonical"' 'hreflang="ru"' 'hreflang="en"' 'hreflang="x-default"' 'og:title' 'og:url' 'og:image' '"@type":"Article"' '"@type":"BreadcrumbList"' '<html lang='; do
  printf '%-30s %s\n' "$pat" "$(grep -c -- "$pat" /tmp/post.html)"
done

if [ -n "$PID" ]; then
  hr "RSS процесса"
  echo "idle: $(ps -o rss= -p "$PID" | tr -d ' ') KB"
  for _ in $(seq 200); do curl -s -o /dev/null "$BASE/" & done; wait
  for _ in $(seq 200); do curl -s -o /dev/null "$BASE/blog/kanon-canonical" & done; wait
  sleep 1
  echo "после 400 параллельных: $(ps -o rss= -p "$PID" | tr -d ' ') KB"
fi
