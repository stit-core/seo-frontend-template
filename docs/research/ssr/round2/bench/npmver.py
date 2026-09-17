import json, subprocess, sys, datetime, re, urllib.parse

PKGS = sys.argv[1:]

def fetch(pkg):
    url = "https://registry.npmjs.org/" + urllib.parse.quote(pkg, safe='@')
    r = subprocess.run(["curl","-sS","-L","--max-time","60","-H","Accept: application/vnd.npm.install-v1+json",url],capture_output=True,text=True)
    try:
        return json.loads(r.stdout)
    except Exception as e:
        return None

def full(pkg):
    url = "https://registry.npmjs.org/" + urllib.parse.quote(pkg, safe='@')
    r = subprocess.run(["curl","-sS","-L","--max-time","60",url],capture_output=True,text=True)
    try:
        return json.loads(r.stdout)
    except Exception:
        return None

now = datetime.datetime(2026,9,16, tzinfo=datetime.timezone.utc)
cut = now - datetime.timedelta(days=365)

for p in PKGS:
    d = full(p)
    if not d:
        print(f"{p}\tERROR")
        continue
    tags = d.get("dist-tags",{})
    times = d.get("time",{})
    latest = tags.get("latest")
    lt = times.get(latest,"?")
    # majors in last 12 months (stable only)
    majors=set(); stable_rel=0; prerel=0
    for v,t in times.items():
        if v in ("created","modified"): continue
        try:
            td = datetime.datetime.fromisoformat(t.replace("Z","+00:00"))
        except Exception:
            continue
        if td < cut: continue
        if re.search(r'-(alpha|beta|rc|canary|next|nightly|experimental|dev|insiders)', v):
            prerel+=1; continue
        stable_rel+=1
        m = re.match(r'^(\d+)\.(\d+)\.(\d+)$', v)
        if m and m.group(2)=="0" and m.group(3)=="0":
            majors.add((v,t[:10]))
    othertags = {}
    print(f"{p}\tlatest={latest}\t{lt[:10]}\tstable12m={stable_rel}\tprerel12m={prerel}\tmajors12m={sorted(majors)}\ttags={othertags}")
