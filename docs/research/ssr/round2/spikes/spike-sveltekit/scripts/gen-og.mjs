import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

// OG-картинки — статические файлы: скрейперы не ждут рантайм-рендера,
// а дисковый кеш для 12 постов не нужен.
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const contentDir = join(root, 'src/entities/post/content')
const outDir = join(root, 'static/og')

await mkdir(outDir, { recursive: true })

const files = (await readdir(contentDir)).filter((f) => f.endsWith('.md'))

function card(title, sub) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#0d1117"/>
  <rect x="0" y="0" width="1200" height="12" fill="#1f6feb"/>
  <text x="72" y="300" font-family="DejaVu Sans, sans-serif" font-size="56" font-weight="700" fill="#f0f6fc">${title}</text>
  <text x="72" y="380" font-family="DejaVu Sans, sans-serif" font-size="32" fill="#9198a1">${sub}</text>
  <text x="72" y="560" font-family="DejaVu Sans, sans-serif" font-size="28" fill="#4493f8">stit demo</text>
</svg>`
}

for (const file of files) {
  const slug = file.replace(/\.md$/, '')
  await sharp(Buffer.from(card(slug, 'stit demo · blog')))
    .png({ compressionLevel: 9 })
    .toFile(join(outDir, `${slug}.png`))
}

await sharp(Buffer.from(card('stit demo', 'Эталонный контент-сайт')))
  .png({ compressionLevel: 9 })
  .toFile(join(root, 'static/og-default.png'))

await writeFile(join(root, 'static/.gitkeep'), '')
console.log(`generated ${files.length + 1} og images`)
