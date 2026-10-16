import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { formatDate, t } from '@/shared/i18n'
import { expectNoA11yViolations, parseHtml, sectionFaults, testLocale } from '@/shared/lib/testing'
import { strategyPage } from '@/shared/strategy'
import { SLOT_SIZES } from '@/shared/ui/section'
import { articleBody } from '../model/block'
import ArticleBody from './article-body.astro'

// Секция — тело записи шаблона записи проекта теста на его локалях: тексты шаблона — copy deck, слоты записи — поля
// записи коллекции.
vi.mock('@/shared/i18n', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestLocales(importOriginal),
)
vi.mock('@/shared/strategy', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestSite(importOriginal),
)

const RU = testLocale('ru')
const EN = testLocale('en')

const record = {
  title: 'Один образ на все среды',
  lead: 'Сборка не знает адреса сайта: его штампует контейнер при старте.',
  date: { published: new Date('2026-09-08'), updated: new Date('2026-09-10') },
  author: { name: 'Анна Смирнова', jobTitle: 'редактор блога', profile: '/avtory/anna-smirnova' },
}
const cover = { src: '/_astro/cover.png', width: 1600, height: 900, format: 'png' as const }

const render = async (
  locale = RU,
  values: Parameters<typeof articleBody.props>[2] = record,
  extra: Record<string, unknown> = {},
) => {
  const container = await AstroContainer.create()
  const html = await container.renderToString(ArticleBody, {
    props: {
      ...articleBody.props(strategyPage('post', locale), 'article-body', values),
      locale,
      ...extra,
    },
    slots: { default: '<h2>Раздел</h2><p>Тело записи.</p>' },
  })
  return { html, doc: parseHtml(html) }
}

describe('ArticleBody', () => {
  it('секция плана — в разметке: заголовок h1 с id секции, лид, автор и даты, тело записи в типографике статьи', async () => {
    for (const locale of [RU, EN]) {
      const { html, doc } = await render(locale)
      expect(
        sectionFaults(html, strategyPage('post', locale), 'article-body', articleBody),
        locale,
      ).toEqual([])
      const heading = doc.querySelector('section > div > article h1')
      expect([heading?.id, heading?.textContent?.trim()]).toEqual([
        'article-body',
        'Один образ на все среды',
      ])
      expect(doc.querySelector('article header h1 + p')?.textContent).toBe(record.lead)
      expect(doc.querySelector('article .prose p')?.textContent).toBe('Тело записи.')
      // Даты — пары «термин — описание» с <time>: дата языка страницы и ISO.
      const terms = [...doc.querySelectorAll('article header dl dt')].map(
        (term) => term.textContent,
      )
      expect(terms, locale).toEqual([
        t(locale, 'post.author'),
        t(locale, 'post.published'),
        t(locale, 'post.updated'),
      ])
      expect(
        [...doc.querySelectorAll('article header dd time')].map((time) => [
          time.getAttribute('datetime'),
          time.textContent,
        ]),
      ).toEqual([
        ['2026-09-08', formatDate(locale, record.date.published)],
        ['2026-09-10', formatDate(locale, record.date.updated)],
      ])
    }
  })

  // Подпись автора — ссылка на страницу о нём: rel="author" называет её профилем автора статьи.
  it('подпись автора — ссылка rel="author" на профиль: имя ссылкой, роль рядом', async () => {
    const { doc } = await render()
    const link = doc.querySelector('article header a[rel="author"]')
    expect([link?.getAttribute('href'), link?.textContent?.trim()]).toEqual([
      '/avtory/anna-smirnova',
      'Анна Смирнова',
    ])
    expect(link?.parentElement?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Анна Смирнова, редактор блога',
    )
  })

  it('без правки — одна дата, без автора — подписи нет; теги — ссылки rel="tag"', async () => {
    const { author: _author, ...anonymous } = record
    const { doc } = await render(
      RU,
      { ...anonymous, date: { published: record.date.published } },
      { tags: [{ label: '#deploy', href: '/blog/tag/deploy' }] },
    )
    expect(doc.querySelectorAll('article header time')).toHaveLength(1)
    expect(doc.querySelector('[rel="author"]')).toBeNull()
    expect(doc.querySelectorAll('article header dt')).toHaveLength(1)
    const tags = doc.querySelector(`ul[aria-label="${t(RU, 'blog.tags')}"]`)
    expect(
      [...(tags?.querySelectorAll('a[rel="tag"]') ?? [])].map((link) => [
        link.getAttribute('href'),
        link.textContent?.trim(),
      ]),
    ).toEqual([['/blog/tag/deploy', '#deploy']])
  })

  // seo:check узнаёт кандидата в LCP по месту — картинка над h1; место и загрузку обложки держит этот тест: под
  // заголовком и с lazy она прошла бы гейт. Файл браузер выбирает до раскладки — по `sizes` колонки чтения.
  it('обложка — кандидат в LCP: над h1, грузится сразу и с приоритетом, размеры заданы, файлы — по колонке чтения', async () => {
    const { html, doc } = await render(RU, { ...record, cover, alt: 'Обложка записи' })
    const img = /<img\b[^>]*>/.exec(html)
    expect(img?.index).toBeLessThan(html.search(/<h1[\s>]/))
    expect(img?.[0]).toContain('fetchpriority="high"')
    expect(img?.[0]).not.toContain('loading="lazy"')
    expect(img?.[0]).toMatch(/\swidth="\d+"/)
    expect(img?.[0]).toMatch(/\sheight="\d+"/)
    expect(doc.querySelector('picture img')?.getAttribute('alt')).toBe('Обложка записи')
    const candidates = [...doc.querySelectorAll('picture source, picture img')]
    expect(candidates.length).toBeGreaterThan(1)
    for (const element of candidates) expect(element.getAttribute('sizes')).toBe(SLOT_SIZES.reading)
  })

  // Статья из плана (не запись коллекции): разделы, «коротко» и источники — тексты секции плана статьи, пропсы блока —
  // те, что дало бы её чтение (у шаблона записи их нет, и запись их не пишет).
  it('разделы плана, «коротко» и источники — в разметке статьи по порядку', async () => {
    const { doc } = await render(RU, record, {
      summary: 'Адрес сайта знает только контейнер.',
      sources: 'Источник: документация Astro.',
      part: [
        { heading: 'Сборка', paragraph: ['Печёт плейсхолдер.'] },
        { heading: 'Старт', paragraph: ['Штампует адрес.', 'Проверяет остаток.'] },
      ],
    })
    expect(doc.querySelector('article header h1 + p + p')?.textContent).toBe(
      'Адрес сайта знает только контейнер.',
    )
    expect(
      [...doc.querySelectorAll('article .prose > section')].map((part) => [
        part.querySelector('h2')?.textContent,
        [...part.querySelectorAll('p')].map((paragraph) => paragraph.textContent),
      ]),
    ).toEqual([
      ['Сборка', ['Печёт плейсхолдер.']],
      ['Старт', ['Штампует адрес.', 'Проверяет остаток.']],
    ])
    expect(doc.querySelector('article > p:last-child')?.textContent).toBe(
      'Источник: документация Astro.',
    )
  })

  it('не имеет нарушений доступности', async () => {
    await expectNoA11yViolations(
      (await render(RU, record, { tags: [{ label: '#deploy', href: '/blog/tag/deploy' }] })).html,
    )
  })
})
