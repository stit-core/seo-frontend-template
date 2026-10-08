import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { writeSitemap } from '../../../scripts/lib/sitemap.mjs'

const ORIGIN = 'https://demo.example'

// Страница сборки: <head> с тем, что читает генератор карты.
const page = (head: string) => `<!doctype html><html><head>${head}</head><body></body></html>`
const canonical = (path: string) => `<link rel="canonical" href="${ORIGIN}${path}">`
const time = (name: string, date: string) =>
  `<meta property="article:${name}_time" content="${date}">`

// Карта — файл сборки: интеграция sitemap-from-build пишет её по страницам dist/client.
describe('карта сайта из выхода сборки', () => {
  let client = ''
  beforeEach(() => {
    client = mkdtempSync(join(tmpdir(), 'sitemap-client-'))
  })
  afterEach(() => rmSync(client, { recursive: true, force: true }))

  const build = (files: Record<string, string>) => {
    for (const [name, content] of Object.entries(files)) {
      mkdirSync(dirname(join(client, name)), { recursive: true })
      writeFileSync(join(client, name), content)
    }
    writeSitemap(client)
    return [
      ...readFileSync(join(client, 'sitemap.xml'), 'utf8').matchAll(
        /<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?<\/url>/g,
      ),
    ].map(([, loc, lastmod]) => (lastmod === undefined ? loc : `${loc} ${lastmod}`))
  }

  it('в карте ровно индексируемые страницы: адрес — canonical, служебных и файлов нет', () => {
    expect(
      build({
        'index.html': page(canonical('/')),
        'about/index.html': page(canonical('/about')),
        'en/index.html': page(canonical('/en')),
        'contacts/spasibo/index.html': page('<meta name="robots" content="noindex">'),
        'bot/index.html': page(`<meta name="googlebot" content="NOINDEX">${canonical('/bot')}`),
        '500.html': page('<meta name="robots" content="noindex">'),
        'rss.xml': '<rss/>',
        '_astro/site.css': 'body{}',
      }),
    ).toEqual([`${ORIGIN}/about`, `${ORIGIN}/en`, `${ORIGIN}/`])
  })

  it('lastmod — дата последнего изменения записи: правка, без неё — публикация; у страниц его нет', () => {
    expect(
      build({
        'index.html': page(canonical('/')),
        'blog/novaya/index.html': page(
          `${canonical('/blog/novaya')}${time('published', '2026-03-01')}`,
        ),
        'blog/pravlenaya/index.html': page(
          `${canonical('/blog/pravlenaya')}${time('published', '2026-02-01')}${time('modified', '2026-02-10')}`,
        ),
      }),
    ).toEqual([
      `${ORIGIN}/blog/novaya 2026-03-01`,
      `${ORIGIN}/blog/pravlenaya 2026-02-10`,
      `${ORIGIN}/`,
    ])
  })

  it('пустая сборка — пустая карта, а не ошибка', () => {
    expect(build({})).toEqual([])
    expect(readFileSync(join(client, 'sitemap.xml'), 'utf8')).toContain('</urlset>')
  })
})
