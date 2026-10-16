import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { formatDate, t } from '@/shared/i18n'
import { expectNoA11yViolations, parseHtml, sectionFaults, testLocale } from '@/shared/lib/testing'
import { strategyPage } from '@/shared/strategy'
import { articleCards } from '../model/block'
import ArticleCards from './article-cards.astro'

// Секция — свежие записи главной проекта теста на его локалях: у немецкой версии нет блога.
vi.mock('@/shared/i18n', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestLocales(importOriginal),
)
vi.mock('@/shared/strategy', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestSite(importOriginal),
)

const RU = testLocale('ru')
const EN = testLocale('en')
const DE = testLocale('de')

// Записи кладёт страница из запроса коллекции: план их не заполняет.
const articles = [
  {
    title: 'Первая запись',
    date: new Date('2026-09-01'),
    link: { href: '/blog/pervaya' },
    excerpt: 'Анонс первой записи.',
  },
  { title: 'Вторая запись', date: new Date('2026-08-15'), link: { href: '/blog/vtoraya' } },
]

const render = async (locale = RU, extra: Record<string, unknown> = {}) => {
  const container = await AstroContainer.create()
  const html = await container.renderToString(ArticleCards, {
    props: { ...articleCards.props(strategyPage('home', locale), 'related'), locale, ...extra },
  })
  return { html, section: parseHtml(html).querySelector('section') }
}

describe('ArticleCards', () => {
  it('секция плана — в разметке на каждом языке страницы: заголовок и ссылка на все записи', async () => {
    for (const locale of [RU, EN, DE]) {
      const { html } = await render(locale, { article: articles })
      expect(
        sectionFaults(html, strategyPage('home', locale), 'related', articleCards),
        locale,
      ).toEqual([])
    }
  })

  it('записи — карточки по порядку: заголовок h3 ссылкой, дата <time> и анонс', async () => {
    const { section } = await render(RU, { article: articles })
    const title = section?.querySelector('h2')
    expect([title?.id, title?.textContent]).toEqual(['related', 'Свежие записи'])
    expect(
      [...(section?.querySelectorAll('ul > li > article') ?? [])].map((card) => [
        card.querySelector('h3 a')?.getAttribute('href'),
        card.querySelector('h3')?.textContent?.trim(),
        card.querySelector('time')?.getAttribute('datetime'),
        card.querySelector('time')?.textContent,
        card.querySelector(':scope > p + p')?.textContent ?? null,
      ]),
    ).toEqual([
      [
        '/blog/pervaya',
        'Первая запись',
        '2026-09-01',
        formatDate(RU, new Date('2026-09-01')),
        'Анонс первой записи.',
      ],
      [
        '/blog/vtoraya',
        'Вторая запись',
        '2026-08-15',
        formatDate(RU, new Date('2026-08-15')),
        null,
      ],
    ])
  })

  it('без записей — текст-заглушка языка страницы; без ссылки на все записи — её нет', async () => {
    const { section } = await render(EN, { all: undefined })
    expect(section?.querySelector('ul')).toBeNull()
    expect(section?.querySelector('h2 + p')?.textContent).toBe(t(EN, 'blog.empty'))
    expect(section?.querySelectorAll('a')).toHaveLength(0)
  })

  it('не имеет нарушений доступности', async () => {
    await expectNoA11yViolations((await render(RU, { article: articles })).html)
  })
})
