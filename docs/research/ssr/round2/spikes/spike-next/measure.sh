#!/bin/bash
# Клон scratchpad/bench/measure.sh (ради сопоставимости со спайками 08-10),
# + отдельный учёт <script noModule> (современный браузер его не грузит).
# $1 = метка, $2 = полный URL страницы
FW="$1"; PAGE="$2"
BASE=$(python3 - "$PAGE" <<'PY'
import sys,urllib.parse
u=urllib.parse.urlsplit(sys.argv[1]); print(f"{u.scheme}://{u.netloc}")
PY
)
TMP=$(mktemp -d)
curl -sS "$PAGE" -o "$TMP/index.html"
HTML_RAW=$(wc -c < "$TMP/index.html")
HTML_GZ=$(gzip -9c "$TMP/index.html" | wc -c)
python3 - "$TMP/index.html" "$BASE" > "$TMP/assets.txt" <<'PY'
import re,sys,urllib.parse
html=open(sys.argv[1],encoding='utf-8',errors='replace').read()
base=sys.argv[2]
found={}
def add(kind,u):
    if u.startswith('data:'): return
    full=urllib.parse.urljoin(base+'/',u)
    if full in found: return
    found[full]=kind
for m in re.finditer(r'<script([^>]*?)>',html,re.I):
    attrs=m.group(1)
    src=re.search(r'\bsrc=["\']([^"\']+)["\']',attrs,re.I)
    if not src: continue
    kind='js-nomodule' if re.search(r'\bnomodule\b',attrs,re.I) else 'js'
    add(kind,src.group(1))
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
inline_total=0
for m in re.finditer(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>',html,re.S|re.I):
    body=m.group(1); inline_total+=len(body.encode())
    for mm in re.finditer(r'["\'](/[A-Za-z0-9_\-./@]+\.m?js)["\']',body): add('js-inline-ref',mm.group(1))
for u,k in found.items(): print(k,u)
print('INLINE_SCRIPT_BYTES',inline_total)
PY
INLINE=$(grep '^INLINE_SCRIPT_BYTES' "$TMP/assets.txt" | awk '{print $2}')
JS_TOTAL=0; CSS_TOTAL=0; JS_GZ=0; CSS_GZ=0; NM_TOTAL=0; NM_GZ=0; FONT_TOTAL=0
echo "### $FW  ($PAGE)"
echo "HTML raw=$HTML_RAW gzip=$HTML_GZ  inline-script-bytes=$INLINE"
while read -r kind u; do
  [ "$kind" = "INLINE_SCRIPT_BYTES" ] && continue
  f="$TMP/$(echo "$u" | md5sum | cut -c1-8)"
  code=$(curl -sS -o "$f" -w '%{http_code}' "$u")
  sz=$(wc -c < "$f"); gz=$(gzip -9c "$f" | wc -c)
  echo "  [$kind] $code $(basename "$u")  raw=$sz gzip=$gz"
  case "$kind" in
    js|js-inline-ref) JS_TOTAL=$((JS_TOTAL+sz)); JS_GZ=$((JS_GZ+gz));;
    js-nomodule) NM_TOTAL=$((NM_TOTAL+sz)); NM_GZ=$((NM_GZ+gz));;
    css) CSS_TOTAL=$((CSS_TOTAL+sz)); CSS_GZ=$((CSS_GZ+gz));;
    font) FONT_TOTAL=$((FONT_TOTAL+sz));;
  esac
done < <(grep -v '^INLINE_SCRIPT_BYTES' "$TMP/assets.txt")
echo "JS  (modern) raw=$JS_TOTAL gzip=$JS_GZ  (+inline $INLINE B)"
echo "JS  (noModule, легаси, не грузится) raw=$NM_TOTAL gzip=$NM_GZ"
echo "CSS total raw=$CSS_TOTAL gzip=$CSS_GZ"
echo "FONT preload raw=$FONT_TOTAL"
rm -rf "$TMP"
