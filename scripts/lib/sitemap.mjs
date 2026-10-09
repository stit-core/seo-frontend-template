// Карта сайта — файл сборки: её пишет интеграция `sitemap-from-build` (astro.config.ts) по выходу
// dist/client, когда страницы уже собраны. В карте ровно индексируемые страницы — те, что без
// noindex: адрес — canonical страницы (на плейсхолдере origin, его штампует entrypoint), lastmod —
// дата последнего изменения записи из её article:*_time. Списка страниц нет: новая страница попадает
// в карту сама, закрытая noindex — сама из неё выпадает. Сверяет карту со сборкой и с источником
// seo:check.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildSitemap } from '../../src/shared/seo/sitemap.ts'
import { decode, headTags, isNoindex } from './html.mjs'
import { walk } from './routes.mjs'

/**
 * Адреса карты сайта с датой последнего изменения — в порядке файла, дубли не схлопываются.
 * @param {string} xml
 * @returns {{ loc: string, lastmod: string | undefined }[]}
 */
export const sitemapUrls = (xml) =>
  [...xml.matchAll(/<url><loc>([^<]*)<\/loc>(?:<lastmod>([^<]*)<\/lastmod>)?<\/url>/g)].map(
    ([, loc = '', lastmod]) => ({ loc: decode(loc), lastmod }),
  )

/**
 * @param {string} clientDir
 * @returns {import('../../src/shared/seo/sitemap.ts').SitemapEntry[]}
 */
export function sitemapEntries(clientDir) {
  return walk(clientDir)
    .filter((file) => file.endsWith('index.html'))
    .flatMap((file) => {
      const tags = headTags(readFileSync(file, 'utf8'))
      const loc = tags.find((tag) => tag.rel === 'canonical')?.href
      if (loc === undefined || isNoindex(tags)) return []
      const time = (/** @type {string} */ name) =>
        tags.find((tag) => tag.property === name)?.content
      // У неправленой записи дата публикации и есть дата последнего изменения.
      return [{ loc, lastmod: time('article:modified_time') ?? time('article:published_time') }]
    })
}

/** @param {string} clientDir */
export function writeSitemap(clientDir) {
  writeFileSync(join(clientDir, 'sitemap.xml'), buildSitemap(sitemapEntries(clientDir)))
}
