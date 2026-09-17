import json, urllib.parse, urllib.request, sys
from concurrent.futures import ThreadPoolExecutor

TECHS = ["Astro","Next.js","Next.js App Router","Nuxt.js","SvelteKit","Svelte","Gatsby",
         "Remix","React Router","Qwik","SolidStart","SolidJS","TanStack Start",
         "Eleventy","Hugo","Jekyll","WordPress","Docusaurus","VitePress","Starlight","Nextra","ALL"]
BASE="https://cdn.httparchive.org/v1"
EPS=["cwv","page-weight","lighthouse","adoption"]

def job(args):
    t,ep=args
    q=urllib.parse.urlencode({"technology":t,"geo":"ALL","rank":"ALL","start":"latest"})
    url=f"{BASE}/{ep}?{q}"
    try:
        with urllib.request.urlopen(url, timeout=60) as r:
            return t,ep,json.loads(r.read().decode())
    except Exception as e:
        return t,ep,{"__error":repr(e)}

tasks=[(t,ep) for t in TECHS for ep in EPS]
out={t:{} for t in TECHS}
with ThreadPoolExecutor(max_workers=12) as ex:
    for t,ep,data in ex.map(job,tasks):
        out[t][ep]=data
        print(t,ep,"ERR" if isinstance(data,dict) else f"n={len(data)}",file=sys.stderr)
json.dump(out,open("ha_raw.json","w"),indent=1)
print("saved")
