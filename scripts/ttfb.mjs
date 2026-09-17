// TTFB на запущенном сервере: последовательные GET через node:http, время до заголовков
// ответа (первый байт). Бюджет prerendered-страниц — единицы миллисекунд локально.
// usage: node scripts/ttfb.mjs [--json] [--n=20] [origin] [path ...]
import http from 'node:http'
import https from 'node:https'

const args = process.argv.slice(2)
const json = args.includes('--json')
const count = Number(args.find((arg) => arg.startsWith('--n='))?.slice('--n='.length) ?? 20)
const positional = args.filter((arg) => !arg.startsWith('--'))
const origin = (positional[0] ?? 'http://127.0.0.1:3000').replace(/\/+$/, '')
const paths = positional.length > 1 ? positional.slice(1) : ['/']

function ttfb(url) {
  return new Promise((resolve, reject) => {
    const startedAt = performance.now()
    const client = url.startsWith('https:') ? https : http
    client
      .get(url, (res) => {
        const ms = performance.now() - startedAt
        res.resume()
        res.on('end', () => resolve({ ms, status: res.statusCode ?? 0 }))
      })
      .on('error', reject)
  })
}

const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]
const median = (sorted) => {
  const middle = sorted.length >> 1
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
const round = (ms) => Math.round(ms * 100) / 100

const rows = []
for (const path of paths) {
  const url = origin + path
  // Прогрев не считается: первый запрос платит за соединение и кеш файловой системы.
  const { status } = await ttfb(url)
  const samples = []
  for (let i = 0; i < count; i++) samples.push((await ttfb(url)).ms)
  const sorted = samples.sort((a, b) => a - b)
  rows.push({
    path,
    status,
    n: count,
    min: round(sorted[0]),
    median: round(median(sorted)),
    p90: round(quantile(sorted, 0.9)),
    max: round(sorted[sorted.length - 1]),
  })
}

if (json) console.info(JSON.stringify(rows))
else {
  for (const row of rows) {
    console.info(
      `${row.path.padEnd(32)} ${row.status}  median=${row.median} ms  p90=${row.p90} ms  min=${row.min} ms  max=${row.max} ms  (n=${row.n})`,
    )
  }
}
process.exit(rows.every((row) => row.status === 200) ? 0 : 1)
