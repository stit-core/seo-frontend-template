import json,sys,datetime
CUT=datetime.date(2025,9,15)
def rep(name,path=None,url=None):
    if path: d=json.load(open(path))
    t=d['time']
    vs=[(v,t[v][:10]) for v in d['versions']]
    recent=[(v,ts) for v,ts in vs if datetime.date.fromisoformat(ts)>=CUT]
    stable=[(v,ts) for v,ts in recent if not any(c in v for c in ['-'])]
    print(f"{name:<26} total={len(vs):<5} last12mo={len(recent):<4} stable_last12mo={len(stable):<4}")
    if stable: print(f"{'':28}stable: {[v for v,_ in sorted(stable,key=lambda x:x[1])]}")
for n,p in [("@builder.io/qwik","_builder.io-qwik.json"),("@11ty/eleventy","_11ty-eleventy.json"),("hono","hono.json"),("@solidjs/start","_solidjs-start.json"),("solid-js","solid-js.json")]:
    try: rep(n,p)
    except Exception as e: print(n,"ERR",e)
