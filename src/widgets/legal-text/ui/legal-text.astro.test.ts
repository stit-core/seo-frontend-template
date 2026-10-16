import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { expectNoA11yViolations, parseHtml, sectionFaults, testLocale } from '@/shared/lib/testing'
import { strategyPage } from '@/shared/strategy'
import { legalText } from '../model/block'
import LegalText from './legal-text.astro'

// Секция — политика ПДн проекта теста: документ только на основном языке.
vi.mock('@/shared/i18n', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestLocales(importOriginal),
)
vi.mock('@/shared/strategy', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestSite(importOriginal),
)

const page = () => strategyPage('privacy', testLocale('ru'))

const render = async () => {
  const container = await AstroContainer.create()
  const html = await container.renderToString(LegalText, {
    props: legalText.props(page(), 'policy'),
  })
  return { html, section: parseHtml(html).querySelector('section') }
}

describe('LegalText', () => {
  it('секция плана — в разметке: название, дата редакции, оператор и каждый раздел', async () => {
    const { html } = await render()
    expect(sectionFaults(html, page(), 'policy', legalText)).toEqual([])
  })

  it('документ — <article>: h1 с id секции, дата и оператор, пункты — <ol> секций с h2 и абзацами по порядку плана', async () => {
    const { section } = await render()
    const article = section?.querySelector('article')
    const title = article?.querySelector('h1')
    expect([title?.id, title?.textContent]).toEqual(['policy', 'Политика теста'])
    expect([...(article?.querySelectorAll(':scope > p') ?? [])].map((p) => p.textContent)).toEqual([
      'Редакция от 1 октября 2026 года',
      'ООО «Тест», ОГРН\u00a01000000000002, Москва',
    ])
    expect(
      [...(article?.querySelectorAll(':scope > ol > li > section') ?? [])].map((clause) => [
        clause.querySelector('h2')?.textContent,
        [...clause.querySelectorAll('p')].map((p) => p.textContent),
      ]),
    ).toEqual([
      ['1. Оператор', ['Данные обрабатывает ООО «Тест».', 'Вопросы — на почту оператора.']],
      ['2. Какие данные', ['Имя и почта из формы.']],
    ])
  })

  it('не имеет нарушений доступности', async () => {
    await expectNoA11yViolations((await render()).html)
  })
})
