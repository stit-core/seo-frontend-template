// Реальные байты, которые браузер тянет на странице: суммируем по типу ресурса.
// usage: node measure-browser.mjs http://127.0.0.1:3204 / /about /blog ...

import { gzipSync } from 'node:zlib'
import { chromium } from '@playwright/test'

const [base, ...paths] = process.argv.slice(2)
const browser = await chromium.launch()

for (const p of paths) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const seen = new Map()
  page.on('response', async (res) => {
    const url = res.url()
    if (seen.has(url)) return
    try {
      const body = await res.body()
      const ct = (res.headers()['content-type'] ?? '').split(';')[0]
      seen.set(url, {
        raw: body.length,
        gz: gzipSync(body, { level: 9 }).length,
        ct,
        status: res.status(),
      })
    } catch {
      /* redirect / no body */
    }
  })
  await page.goto(base + p, { waitUntil: 'networkidle' })
  const h1 = await page
    .locator('h1')
    .first()
    .textContent()
    .catch(() => null)

  const buckets = {
    js: [0, 0],
    css: [0, 0],
    html: [0, 0],
    font: [0, 0],
    img: [0, 0],
    other: [0, 0],
  }
  const files = []
  for (const [url, v] of seen) {
    let k = 'other'
    if (v.ct.includes('javascript')) k = 'js'
    else if (v.ct.includes('css')) k = 'css'
    else if (v.ct.includes('html')) k = 'html'
    else if (v.ct.includes('font')) k = 'font'
    else if (v.ct.startsWith('image/')) k = 'img'
    buckets[k][0] += v.raw
    buckets[k][1] += v.gz
    files.push(`${k} ${v.status} ${v.raw}/${v.gz} ${url.replace(base, '')}`)
  }
  console.log(`### ${p}   (h1: ${JSON.stringify(h1)})`)
  for (const f of files.sort()) console.log(`  ${f}`)
  for (const [k, [raw, gz]] of Object.entries(buckets)) {
    if (raw) console.log(`  = ${k}: raw=${raw} gzip=${gz}`)
  }
  console.log('')
  await ctx.close()
}

await browser.close()
