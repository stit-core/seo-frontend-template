import { gzipSync } from 'node:zlib'
import { test } from '@playwright/test'

interface Row {
  page: string
  doc: number
  docGzip: number
  js: number
  jsGzip: number
  css: number
  cssGzip: number
  img: number
  font: number
  files: string[]
}

// Не ассерт, а измеритель: печатает реальный вес страницы по типам ресурсов.
test('вес страниц по типам ресурсов', async ({ page }) => {
  const rows: Row[] = []
  for (const path of ['/', '/blog', '/blog/kanon-canonical', '/about', '/contact', '/now', '/en']) {
    const row: Row = {
      page: path,
      doc: 0,
      docGzip: 0,
      js: 0,
      jsGzip: 0,
      css: 0,
      cssGzip: 0,
      img: 0,
      font: 0,
      files: [],
    }
    const onResponse = async (response: import('@playwright/test').Response) => {
      const type = response.request().resourceType()
      const body = await response.body().catch(() => Buffer.alloc(0))
      const gz = body.length > 0 ? gzipSync(body, { level: 9 }).length : 0
      if (type === 'document') {
        row.doc += body.length
        row.docGzip += gz
      } else if (type === 'script') {
        row.js += body.length
        row.jsGzip += gz
        row.files.push(`${response.url().split('/').pop()}=${gz}B`)
      } else if (type === 'stylesheet') {
        row.css += body.length
        row.cssGzip += gz
        row.files.push(`${response.url().split('/').pop()}=${gz}B`)
      } else if (type === 'image') {
        row.img += body.length
        row.files.push(`${response.url().split('/').pop()}=${body.length}B`)
      } else if (type === 'font') {
        row.font += body.length
        row.files.push(`${response.url().split('/').pop()}=${body.length}B`)
      }
    }
    page.on('response', onResponse)
    await page.goto(path, { waitUntil: 'networkidle' })
    await page.waitForTimeout(700)
    page.off('response', onResponse)
    rows.push(row)
  }
  console.info(
    `\nWEIGHT-TABLE\n${rows
      .map(
        (r) =>
          `${r.page.padEnd(24)} doc=${r.doc}/${r.docGzip}gz  js=${r.js}/${r.jsGzip}gz  css=${r.css}/${r.cssGzip}gz  img=${r.img}  font=${r.font}\n    ${r.files.join(' ')}`,
      )
      .join('\n')}\n`,
  )
})
