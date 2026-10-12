import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { brotliBytes } from '../../../scripts/lib/site-policy.mjs'

// Какую страницу мерить, конфиг size-limit решает сам по выходу сборки — при загрузке, из каталога
// запуска. Тест загружает его в отдельном процессе над временной сборкой.
const config = fileURLToPath(new URL('../../../.size-limit.cjs', import.meta.url))

type Limit = { name: string; path: string; limit: string }

// Строки бюджета над сборкой из этих файлов `dist/client`; `exists` — путь строки ведёт к файлу.
function limitsOf(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'size-limit-'))
  try {
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(join(root, 'dist/client', path)), { recursive: true })
      writeFileSync(join(root, 'dist/client', path), content)
    }
    const load = `process.stdout.write(JSON.stringify(require(${JSON.stringify(config)})))`
    const result = spawnSync(process.execPath, ['-e', load], {
      cwd: root,
      encoding: 'utf8',
      timeout: 10_000,
    })
    return (JSON.parse(result.stdout) as Limit[]).map((limit) => ({
      ...limit,
      exists: existsSync(join(root, limit.path)),
    }))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

const htmlLimit = (pages: Record<string, string>) => {
  const html = limitsOf(pages).find((limit) => limit.name.startsWith('HTML'))
  return { path: html?.path ?? '', exists: html?.exists ?? false }
}

describe('бюджет HTML size-limit', () => {
  // Повторы жмутся почти в ноль: страница длиннее в байтах легче по сети.
  it('мерит самую тяжёлую страницу сборки — по brotli, а не по байтам', () => {
    const long = `<p>${'повтор '.repeat(3000)}</p>`
    const dense = `<p>${Array.from({ length: 900 }, (_, i) => (i * 7919).toString(36)).join(' ')}</p>`
    expect(long.length).toBeGreaterThan(dense.length)
    expect(brotliBytes(dense)).toBeGreaterThan(brotliBytes(long))
    // Самая тяжёлая — не первая и не последняя ни по алфавиту, ни при обходе каталога.
    const pages = { 'index.html': long, 'a/index.html': '<p>a</p>', 'b/index.html': dense }
    expect(htmlLimit(pages).path).toBe('dist/client/b/index.html')
  })

  it('сборка без страниц — путь к странице, которой нет: size-limit падает, а не молчит', () => {
    expect(htmlLimit({}).exists).toBe(false)
  })
})

describe('бюджет шрифтов size-limit', () => {
  const fontLimits = (files: Record<string, string>) =>
    limitsOf({ 'index.html': '<p>a</p>', ...files }).filter((limit) =>
      limit.path.startsWith('dist/client/_astro/fonts/'),
    )

  // Путь без файлов size-limit считает ошибкой: у сайта без шрифтов строки нет вовсе.
  it('строка возникает с первым файлом шрифта сборки', () => {
    expect(fontLimits({})).toEqual([])
    expect(fontLimits({ '_astro/fonts/golos.woff2': 'woff2' })).toHaveLength(1)
  })
})
