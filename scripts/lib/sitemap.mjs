// Карта сайта — файл сборки: её пишет интеграция `sitemap-from-build` (astro.config.ts) по выходу
// dist/client, когда страницы уже собраны. В карте ровно индексируемые страницы — те, что без
// noindex: адрес — canonical страницы (на плейсхолдере origin, его штампует entrypoint), lastmod —
// дата страницы (`pageDateOf`). Списка страниц нет: новая страница попадает в карту сама, закрытая
// noindex — сама из неё выпадает. Сверяет карту со сборкой и с источником seo:check.
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
 * Дата страницы — дата последнего изменения записи коллекции, которую страница называет в <head>: правка
 * (`article:modified_time`), у неправленой записи — публикация. Ею генератор датирует страницу в карте, и её же
 * seo:check сверяет с источником: у записи — правка или публикация frontmatter, у страницы вне коллекций даты нет.
 * @param {import('./html.mjs').HeadTag[]} tags
 */
export function pageDateOf(tags) {
  const time = (/** @type {string} */ name) => tags.find((tag) => tag.property === name)?.content
  return time('article:modified_time') ?? time('article:published_time')
}

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
      return [{ loc, lastmod: pageDateOf(tags) }]
    })
}

/** @param {string} clientDir */
export function writeSitemap(clientDir) {
  writeFileSync(join(clientDir, 'sitemap.xml'), buildSitemap(sitemapEntries(clientDir)))
}
