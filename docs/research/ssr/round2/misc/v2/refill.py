import json, urllib.parse, urllib.request, sys
from concurrent.futures import ThreadPoolExecutor
BASE="https://cdn.httparchive.org/v1"
d=json.load(open('ha_raw.json'))
missing=[(t,ep) for t in d for ep in d[t] if isinstance(d[t][ep],dict)]
print("missing:",missing,file=sys.stderr)
def job(a):
    t,ep=a
    q=urllib.parse.urlencode({"technology":t,"geo":"ALL","rank":"ALL","start":"latest"})
    for _ in range(3):
        try:
            with urllib.request.urlopen(f"{BASE}/{ep}?{q}",timeout=90) as r:
                return t,ep,json.loads(r.read().decode())
        except Exception as e:
            err=repr(e)
    return t,ep,{"__error":err}
with ThreadPoolExecutor(max_workers=6) as ex:
    for t,ep,data in ex.map(job,missing):
        d[t][ep]=data; print(t,ep,"ERR" if isinstance(data,dict) else "ok",file=sys.stderr)
json.dump(d,open('ha_raw.json','w'),indent=1)
