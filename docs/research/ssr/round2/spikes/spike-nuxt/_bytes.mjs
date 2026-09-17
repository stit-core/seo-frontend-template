import { chromium } from '@playwright/test'

const base = process.env.BASE || 'http://127.0.0.1:3202'
const pages = ['/', '/about', '/blog', '/blog/ssr-bez-cdn', '/contact', '/now', '/en/about']

const exe = process.env.CHROME_PATH
const browser = await chromium.launch(exe ? { executablePath: exe } : {})

function bucket(url, type) {
  if (/\.js($|\?)/.test(url) || type === 'script') return 'js'
  if (/\.css($|\?)/.test(url) || type === 'stylesheet') return 'css'
  if (/\.woff2?($|\?)/.test(url) || type === 'font') return 'font'
  if (type === 'image' || /_ipx|\.png|\.avif|\.webp/.test(url)) return 'img'
  if (/\.json($|\?)/.test(url)) return 'json'
  return 'other'
}

const rows = []
for (const path of pages) {
  const context = await browser.newContext()
  const page = await context.newPage()
  const sizes = { js: 0, css: 0, font: 0, img: 0, json: 0, other: 0 }
  const urls = []
  page.on('response', async (response) => {
    const type = response.request().resourceType()
    const url = response.url()
    let length = 0
    try {
      length = Number(response.headers()['content-length'] || 0)
      if (!length) length = (await response.body()).length
    } catch {}
    const key = bucket(url, type)
    sizes[key] += length
    if (key === 'js') urls.push(`${url.replace(base, '')}=${length}`)
  })
  await page.goto(base + path, { waitUntil: 'load' })
  rows.push({ path, ...sizes, jsFiles: urls.length })
  await context.close()
}
await browser.close()

const fmt = (n) => `${(n / 1024).toFixed(1)}K`
console.log('маршрут'.padEnd(22), 'JS(wire)', 'CSS', 'FONT', 'IMG', 'JSON', 'файлов JS')
for (const r of rows) {
  console.log(
    r.path.padEnd(22),
    fmt(r.js).padEnd(9),
    fmt(r.css).padEnd(6),
    fmt(r.font).padEnd(6),
    fmt(r.img).padEnd(8),
    fmt(r.json).padEnd(7),
    r.jsFiles,
  )
}
