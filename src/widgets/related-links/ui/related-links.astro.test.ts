import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { expectNoA11yViolations, parseHtml, sectionFaults, testLocale } from '@/shared/lib/testing'
import { strategyPage } from '@/shared/strategy'
import { relatedLinks } from '../model/block'
import RelatedLinks from './related-links.astro'

// Секция — «связанные» шаблона записи проекта теста на его локалях: заголовок — copy deck, ссылки — записи коллекции.
vi.mock('@/shared/i18n', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestLocales(importOriginal),
)
vi.mock('@/shared/strategy', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestSite(importOriginal),
)

const RU = testLocale('ru')
const EN = testLocale('en')

const items = [
  { title: 'Честные 404 и 410', link: { href: '/blog/chestnye-404-i-410' } },
  { title: 'Sitemap и robots', link: { href: '/blog/sitemap-i-robots' } },
]

const render = async (locale = RU) => {
  const container = await AstroContainer.create()
  const html = await container.renderToString(RelatedLinks, {
    props: relatedLinks.props(strategyPage('post', locale), 'related', { item: items }),
  })
  return { html, doc: parseHtml(html) }
}

describe('RelatedLinks', () => {
  it('секция плана — в разметке на каждом языке: заголовок h2 с id секции', async () => {
    for (const locale of [RU, EN]) {
      const { html, doc } = await render(locale)
      expect(sectionFaults(html, strategyPage('post', locale), 'related', relatedLinks)).toEqual([])
      expect(doc.querySelector('section h2')?.id).toBe('related')
    }
  })

  // Связанные — навигация дальше по сайту (html каталога): список ссылок, подписанный заголовком секции.
  it('ссылки — навигация, подписанная заголовком секции: записи по порядку, текст ссылки — заголовок записи', async () => {
    const { doc } = await render()
    const nav = doc.querySelector('section nav[aria-labelledby="related"]')
    expect(
      [...(nav?.querySelectorAll('ul > li > a') ?? [])].map((link) => [
        link.getAttribute('href'),
        link.textContent?.trim(),
      ]),
    ).toEqual(items.map((item) => [item.link.href, item.title]))
  })

  it('не имеет нарушений доступности', async () => {
    await expectNoA11yViolations((await render()).html)
  })
})
