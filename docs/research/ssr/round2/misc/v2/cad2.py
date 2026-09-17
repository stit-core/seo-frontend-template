import json,datetime
CUT=datetime.date(2025,9,15)
def rep(name,path):
    d=json.load(open(path)); t=d['time']
    vs=[(v,t[v][:10]) for v in d['versions'] if v in t]
    recent=[(v,ts) for v,ts in vs if datetime.date.fromisoformat(ts)>=CUT]
    stable=sorted([(v,ts) for v,ts in recent if '-' not in v],key=lambda x:x[1])
    pre=len(recent)-len(stable)
    print(f"{name:<24} total={len(vs):<5} last12mo={len(recent):<4} stable={len(stable):<4} pre={pre}")
    if stable: print(f"{'':26}{[f'{v}@{ts[5:]}' for v,ts in stable]}")
for n,p in [("@builder.io/qwik","-builder.io_qwik.json"),("@11ty/eleventy","-11ty_eleventy.json"),
            ("@solidjs/start","-solidjs_start.json"),("@solidjs/router","-solidjs_router.json"),
            ("@11ty/eleventy-img","-11ty_eleventy-img.json")]:
    rep(n,p)
