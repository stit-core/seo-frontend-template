import re,html,sys
s=open(sys.argv[1],encoding='utf-8',errors='replace').read()
m=re.search(r'(?is)<main[^>]*>(.*?)</main>', s)
body = m.group(1) if m else s
body=re.sub(r'(?is)<(script|style|nav|aside)[^>]*>.*?</\1>',' ',body)
body=re.sub(r'(?is)</(p|div|li|h[1-6]|pre|tr)>','\n',body)
body=re.sub(r'(?s)<[^>]+>',' ',body); body=html.unescape(body)
body=re.sub(r'[ \t]+',' ',body); body=re.sub(r'\n\s*\n+','\n',body)
print(body.strip()[:int(sys.argv[2]) if len(sys.argv)>2 else 3000])
