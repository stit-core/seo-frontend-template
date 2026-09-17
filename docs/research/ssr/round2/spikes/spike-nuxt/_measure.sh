#!/usr/bin/env bash
# Батарея измерений spike-nuxt. Аргумент — метка прогона (A/B/docker).
set -u
B="${BASE:-http://127.0.0.1:3202}"
LABEL="${1:-A}"
PIDFILE="${PIDFILE:-}"

hr() { printf '\n=== %s ===\n' "$1"; }

hr "$LABEL: статусы"
for p in / /about /now /blog /blog/ssr-bez-cdn /old /blog/net-takogo /xx/ /about/ /en /en/about /healthz /robots.txt /sitemap_index.xml /__sitemap__/ru-RU.xml /rss.xml; do
  printf '%-28s %s  (redirect -> %s)\n' "$p" \
    "$(curl -s -o /dev/null -w '%{http_code}' --max-redirs 0 "$B$p")" \
    "$(curl -s -o /dev/null -w '%{redirect_url}' --max-redirs 0 "$B$p")"
done

hr "$LABEL: TTFB (медиана 20)"
for p in / /about /blog/ssr-bez-cdn /now /healthz /en/blog; do
  vals=()
  for _ in $(seq 20); do vals+=("$(curl -s -o /dev/null -w '%{time_starttransfer}' "$B$p")"); done
  printf '%-22s median=%s  min=%s  max=%s\n' "$p" \
    "$(printf '%s\n' "${vals[@]}" | sort -n | sed -n '10p')" \
    "$(printf '%s\n' "${vals[@]}" | sort -n | head -1)" \
    "$(printf '%s\n' "${vals[@]}" | sort -n | tail -1)"
done

hr "$LABEL: размеры HTML (raw / gzip -9 / brotli-от-сервера)"
for p in / /about /blog/ssr-bez-cdn /contact /now /en; do
  raw=$(curl -s "$B$p" | wc -c)
  gz=$(curl -s "$B$p" | gzip -9c | wc -c)
  br=$(curl -s -H 'Accept-Encoding: br' -o /dev/null -w '%{size_download}' "$B$p")
  printf '%-22s raw=%-8s gzip9=%-7s wire(br)=%s\n' "$p" "$raw" "$gz" "$br"
done

hr "$LABEL: заголовки"
for p in / /about /now /healthz /covers/ssr-bez-cdn.png /fonts/inter-latin-wght-normal.woff2; do
  printf -- '--- %s\n' "$p"
  curl -sI "$B$p" | grep -aiE 'HTTP/|cache-control|etag|content-encoding|x-robots|x-nitro|x-cache|age|vary|content-type' | sed 's/^/    /'
done

hr "$LABEL: Googlebot без JS"
for p in / /blog/ssr-bez-cdn; do
  body=$(curl -s -A 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' "$B$p")
  printf '%-22s h1=%s  canonical=%s  jsonld=%s  hreflang=%s  og:image=%s  words=%s\n' "$p" \
    "$(printf '%s' "$body" | grep -ao '<h1' | wc -l)" \
    "$(printf '%s' "$body" | grep -ao 'rel="canonical"' | wc -l)" \
    "$(printf '%s' "$body" | grep -ao 'application/ld+json' | wc -l)" \
    "$(printf '%s' "$body" | grep -ao 'hreflang=' | wc -l)" \
    "$(printf '%s' "$body" | grep -ao 'property="og:image"' | wc -l)" \
    "$(printf '%s' "$body" | sed 's/<[^>]*>/ /g' | wc -w)"
done

hr "$LABEL: prerender или рендер на запрос"
for p in /about /now /blog/ssr-bez-cdn; do
  a=$(curl -s "$B$p" | md5sum | cut -d' ' -f1)
  sleep 0.4
  b=$(curl -s "$B$p" | md5sum | cut -d' ' -f1)
  [ "$a" = "$b" ] && echo "$p: тела совпадают" || echo "$p: тела различаются"
done

hr "$LABEL: srcset обложки"
curl -s "$B/blog/ssr-bez-cdn" | grep -ao '<source[^>]*>' | head -4
curl -s "$B/blog/ssr-bez-cdn" | grep -ao '<img[^>]*>' | head -2
