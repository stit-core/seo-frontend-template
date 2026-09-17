#!/bin/bash
# $1 = имя, $2 = базовый URL. Дедуп по URL; изображения не считаются в JS/CSS.
FW="$1"; URL="$2"
TMP=$(mktemp -d)
curl -sS "$URL/" -o "$TMP/index.html"
HTML_RAW=$(wc -c < "$TMP/index.html")
HTML_GZ=$(gzip -9c "$TMP/index.html" | wc -c)
python3 - "$TMP/index.html" "$URL" > "$TMP/assets.txt" <<'PY'
import re,sys,urllib.parse
html=open(sys.argv[1],encoding='utf-8',errors='replace').read()
base=sys.argv[2]
found={}   # url -> kind
def add(kind,u):
    if not u or u.startswith('data:') or u.startswith('http') and not u.startswith(base): pass
    if u.startswith('data:'): return
    full=urllib.parse.urljoin(base+'/',u)
    if full in found: return
    found[full]=kind
for m in re.finditer(r'<script[^>]*\bsrc=["\']([^"\']+)["\']',html,re.I): add('js',m.group(1))
for m in re.finditer(r'<link\b([^>]*)>',html,re.I):
    attrs=m.group(1)
    rel=re.search(r'\brel=["\']([^"\']+)["\']',attrs,re.I)
    href=re.search(r'\bhref=["\']([^"\']+)["\']',attrs,re.I)
    if not rel or not href: continue
    r=rel.group(1).lower(); h=href.group(1)
    if r=='stylesheet': add('css',h)
    elif r in ('modulepreload','preload'):
        asattr=re.search(r'\bas=["\']([^"\']+)["\']',attrs,re.I)
        a=asattr.group(1).lower() if asattr else ('script' if r=='modulepreload' else '')
        if a=='script' or h.endswith('.js') or h.endswith('.mjs'): add('js',h)
        elif a=='style' or h.endswith('.css'): add('css',h)
        elif a in ('font',): add('font',h)
        else: add('other',h)
# ссылки на бандлы внутри инлайновых скриптов (Qwik/RR/Solid любят так)
inline_total=0
for m in re.finditer(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>',html,re.S|re.I):
    body=m.group(1); inline_total+=len(body.encode())
    for mm in re.finditer(r'["\'](/[A-Za-z0-9_\-./@]+\.m?js)["\']',body): add('js-inline-ref',mm.group(1))
for u,k in found.items(): print(k,u)
print('INLINE_SCRIPT_BYTES',inline_total)
PY
INLINE=$(grep '^INLINE_SCRIPT_BYTES' "$TMP/assets.txt" | awk '{print $2}')
JS_TOTAL=0; CSS_TOTAL=0; JS_GZ=0; CSS_GZ=0
echo "### $FW"
echo "HTML raw=$HTML_RAW gzip=$HTML_GZ  inline-script-bytes=$INLINE"
while read -r kind u; do
  [ "$kind" = "INLINE_SCRIPT_BYTES" ] && continue
  f="$TMP/$(echo "$u" | md5sum | cut -c1-8)"
  code=$(curl -sS -o "$f" -w '%{http_code}' "$u")
  sz=$(wc -c < "$f"); gz=$(gzip -9c "$f" | wc -c)
  echo "  [$kind] $code $(basename "$u")  raw=$sz gzip=$gz"
  case "$kind" in
    js|js-inline-ref) JS_TOTAL=$((JS_TOTAL+sz)); JS_GZ=$((JS_GZ+gz));;
    css) CSS_TOTAL=$((CSS_TOTAL+sz)); CSS_GZ=$((CSS_GZ+gz));;
  esac
done < <(grep -v '^INLINE_SCRIPT_BYTES' "$TMP/assets.txt")
echo "JS  total raw=$JS_TOTAL gzip=$JS_GZ  (+inline $INLINE B)"
echo "CSS total raw=$CSS_TOTAL gzip=$CSS_GZ"
rm -rf "$TMP"
