import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type * as Astro from 'astro'
import site from '../../../astro.config.ts'
import { scriptViolations } from '../../../scripts/lib/site-policy.mjs'

// Остров-файл реестр узнаёт по модулю, в который Astro собирает <script> компонента. Самый простой
// остров — короткий скрипт без импортов: его Astro встроил бы в страницу, и модуля бы не было.
// Мини-проект собирается настоящим Astro с настройками сборки сайта.
const COMPONENT = 'src/widgets/copy-link/ui/copy-link.astro'
const files = {
  [COMPONENT]: `<button type="button" data-copy-link>Скопировать адрес</button>
<script>
  for (const button of document.querySelectorAll('[data-copy-link]')) {
    button.addEventListener('click', () => navigator.clipboard.writeText(location.href))
  }
</script>
<style>
  button { cursor: copy; }
</style>
`,
  'src/pages/index.astro': `---
import CopyLink from '../widgets/copy-link/ui/copy-link.astro'
---
<html lang="ru"><head><title>Остров-файл</title></head><body><CopyLink /></body></html>
`,
}

const repo = fileURLToPath(new URL('../../../', import.meta.url))
// `astro` в тестах — модуль типов (алиас Vite у Astro): сборщик берётся из файла пакета.
const { build } = (await import(
  pathToFileURL(join(repo, 'node_modules/astro/dist/core/index.js')).href
)) as typeof Astro
let root = ''
let html = ''
beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'island-file-'))
  // Зависимости — сайта: мини-проект собирается его Astro.
  symlinkSync(join(repo, 'node_modules'), join(root, 'node_modules'))
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true })
    writeFileSync(join(root, name), content)
  }
  await build({
    root,
    logLevel: 'silent',
    cacheDir: join(root, '.cache'),
    build: site.build ?? {},
    vite: { cacheDir: join(root, '.vite'), build: site.vite?.build ?? {} },
  })
  html = readFileSync(join(root, 'dist/index.html'), 'utf8')
}, 60_000)
afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('остров-файл в сборке сайта', () => {
  it('короткий скрипт без импортов — модуль сборки, стиль — файл: в страницу не встроено ничего', () => {
    const scripts = Array.from(html.matchAll(/<script\b([^>]*)>/g), ([, attrs = '']) =>
      attrs.trim(),
    )
    expect(scripts).toEqual([
      expect.stringMatching(
        /^type="module" src="\/_astro\/copy-link\.astro_astro_type_script_index_0_lang\.[\w-]+\.js"$/,
      ),
    ])
    expect(html).not.toContain('<style')
    expect(
      readdirSync(join(root, 'dist/_astro')).filter((file) => file.endsWith('.css')),
    ).toHaveLength(1)
  })

  it('со строкой реестра — остров на своей странице; без неё — скрипт вне реестра', () => {
    const copyLink = {
      file: COMPONENT,
      basis: 'момент плана страницы: адрес страницы — в буфер обмена',
      pages: ['/'],
      markup: 'data-copy-link',
      budget: 400,
    }
    expect(scriptViolations(html, '/', { copyLink })).toEqual([])
    expect(scriptViolations(html, '/', {})).toEqual([
      expect.stringContaining('файла-острова нет в списке ISLANDS'),
    ])
  })
})
