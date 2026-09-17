import re,html,sys
s=open(sys.argv[1],encoding='utf-8',errors='replace').read()
# strip the sidebar nav blocks by cutting at the "On this page" marker or the h1
s=re.sub(r'(?is)<(script|style|nav|aside|header|footer)[^>]*>.*?</\1>',' ',s)
m=re.search(r'(?is)<main[^>]*>(.*?)</main>', s)
body = m.group(1) if m else s
body=re.sub(r'(?is)</(p|div|li|h[1-6]|pre|tr)>','\n',body)
body=re.sub(r'(?s)<[^>]+>',' ',body); body=html.unescape(body)
body=re.sub(r'[ \t]+',' ',body); body=re.sub(r'\n\s*\n+','\n',body)
lines=[l for l in body.split('\n') if l.strip()]
# drop the long nav run: find index of last very-short line streak
txt='\n'.join(lines)
i=txt.find('On this page')
print(txt[i if i>0 else 0:][:int(sys.argv[2]) if len(sys.argv)>2 else 3000])
