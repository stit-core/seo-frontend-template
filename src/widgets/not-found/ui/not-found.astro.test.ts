import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { expectNoA11yViolations, parseHtml, sectionFaults, testLocale } from '@/shared/lib/testing'
import { strategyPage } from '@/shared/strategy'
import { notFound } from '../model/block'
import NotFound from './not-found.astro'

// Секция — 404 проекта теста на его локалях: у немецкой версии нет блога и контактов.
vi.mock('@/shared/i18n', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestLocales(importOriginal),
)
vi.mock('@/shared/strategy', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestSite(importOriginal),
)

const RU = testLocale('ru')
const EN = testLocale('en')
const DE = testLocale('de')

const render = async (locale = RU) => {
  const container = await AstroContainer.create()
  const html = await container.renderToString(NotFound, {
    props: notFound.props(strategyPage('not-found', locale), 'not-found'),
  })
  return { html, section: parseHtml(html).querySelector('section') }
}

describe('NotFound', () => {
  it('секция плана — в разметке на каждом языке страницы: текст, главное действие и каждый путь', async () => {
    for (const locale of [RU, EN, DE]) {
      const { html } = await render(locale)
      expect(
        sectionFaults(html, strategyPage('not-found', locale), 'not-found', notFound),
        locale,
      ).toEqual([])
    }
  })

  it('заголовок страницы h1 и текст; главное действие — кнопкой, пути на разделы — ссылками по порядку плана', async () => {
    const { section } = await render(EN)
    const title = section?.querySelector('h1, h2')
    expect([title?.tagName, title?.id, title?.textContent]).toEqual([
      'H1',
      'not-found',
      'Страницы нет (en)',
    ])
    expect(section?.querySelector('h1 + p')?.textContent).toBe(
      'Проверьте адрес или откройте раздел. (en)',
    )
    expect(
      [...(section?.querySelectorAll('a') ?? [])].map((link) => [
        link.getAttribute('href'),
        link.textContent?.trim(),
        link.classList.contains('button'),
      ]),
    ).toEqual([
      ['/en', 'На главную теста (en)', true],
      ['/en/blog', 'Заметки (en)', false],
      ['/en/about', 'О студии (en)', false],
      ['/en/contacts', 'Связаться (en)', false],
    ])
  })

  // Раздела без версии на языке страницы путь ведёт на версию основного языка и называет его.
  it('путь в раздел без версии на языке страницы — версия основного языка с hreflang', async () => {
    const { section } = await render(DE)
    expect(
      [...(section?.querySelectorAll('ul a') ?? [])].map((link) => [
        link.getAttribute('href'),
        link.getAttribute('hreflang'),
      ]),
    ).toEqual([
      ['/blog', 'ru'],
      ['/de/about', null],
      ['/contacts', 'ru'],
    ])
  })

  it('не имеет нарушений доступности', async () => {
    await expectNoA11yViolations((await render()).html)
  })
})
