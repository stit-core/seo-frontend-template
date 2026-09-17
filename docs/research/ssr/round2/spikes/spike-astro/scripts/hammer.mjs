// Честная параллельность: N fetch'ей в одном тике, без задержки процессов.
const base = process.argv[2] ?? 'http://127.0.0.1:3201'
const path = process.argv[3] ?? '/'
const n = Number(process.argv[4] ?? 200)
const t0 = performance.now()
const results = await Promise.all(
  Array.from({ length: n }, async () => {
    const r = await fetch(base + path)
    await r.arrayBuffer()
    return r.headers.get('x-astro-cache') ?? 'none'
  }),
)
const counts = {}
for (const r of results) counts[r] = (counts[r] ?? 0) + 1
console.info(
  `${path} n=${n} ${JSON.stringify(counts)} wall=${(performance.now() - t0).toFixed(1)}ms`,
)
