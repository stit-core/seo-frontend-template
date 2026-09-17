import json, subprocess, urllib.parse, sys, os

TECHS = ["Astro","Next.js","Next.js App Router","Nuxt.js","SvelteKit","Svelte","Gatsby",
         "Remix","React Router","Qwik","SolidStart","SolidJS","TanStack Start",
         "Eleventy","Hugo","Jekyll","WordPress","Docusaurus","VitePress","Starlight","Nextra","ALL"]
BASE="https://cdn.httparchive.org/v1"

def get(ep, tech):
    q = urllib.parse.urlencode({"technology":tech,"geo":"ALL","rank":"ALL","start":"latest"})
    url=f"{BASE}/{ep}?{q}"
    r = subprocess.run(["curl","-sS","-L","--max-time","45",url],capture_output=True,text=True)
    try:
        return json.loads(r.stdout)
    except Exception as e:
        return {"__error":str(e),"raw":r.stdout[:300]}

out={}
for t in TECHS:
    out[t]={}
    for ep in ["cwv","page-weight","lighthouse","adoption"]:
        out[t][ep]=get(ep,t)
        print(t, ep, "ok" if not isinstance(out[t][ep],dict) else "ERR", file=sys.stderr)
json.dump(out, open("ha_raw.json","w"), indent=1)
print("saved")
