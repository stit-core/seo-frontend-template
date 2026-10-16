import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import {
  expectNoA11yViolations,
  PACKAGE_LANDING,
  parseHtml,
  sectionFaults,
  testLocale,
} from '@/shared/lib/testing'
import { projectOf, siteOf, strategyPage } from '@/shared/strategy'
import { thankYou } from '../model/block'
import ThankYou from './thank-you.astro'

// Секция — «спасибо» проекта теста на его локалях и посадочной фикстуры базы package-landing.
vi.mock('@/shared/i18n', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestLocales(importOriginal),
)
vi.mock('@/shared/strategy', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestSite(importOriginal),
)

const RU = testLocale('ru')
const EN = testLocale('en')
const landing = () => siteOf(projectOf(PACKAGE_LANDING)).strategyPage('spasibo', RU)

const render = async (props: Record<string, unknown>) => {
  const container = await AstroContainer.create()
  const html = await container.renderToString(ThankYou, { props })
  return { html, section: parseHtml(html).querySelector('section') }
}

describe('ThankYou', () => {
  it('секция плана — в разметке: «спасибо» сайта на каждом языке и посадочной фикстуры базы', async () => {
    for (const locale of [RU, EN]) {
      const page = strategyPage('thank-you', locale)
      const { html } = await render(thankYou.props(page, 'confirmation'))
      expect(sectionFaults(html, page, 'confirmation', thankYou), locale).toEqual([])
    }
    const { html } = await render(thankYou.props(landing(), 'confirmation'))
    expect(sectionFaults(html, landing(), 'confirmation', thankYou)).toEqual([])
  })

  it('подтверждение — заголовок страницы h1, под ним что дальше и второй путь ссылкой', async () => {
    const { section } = await render(thankYou.props(strategyPage('thank-you', EN), 'confirmation'))
    const title = section?.querySelector('h1, h2')
    expect([title?.tagName, title?.id, title?.textContent]).toEqual([
      'H1',
      'confirmation',
      'Заявка у нас (en)',
    ])
    expect(section?.querySelector('h1 + p')?.textContent).toBe(
      'Ответим на почту в течение рабочего дня. (en)',
    )
    const link = section?.querySelector('a')
    expect([
      link?.getAttribute('href'),
      link?.textContent?.trim(),
      link?.classList.contains('button'),
    ]).toEqual(['/en/contacts', 'Вернуться к контактам (en)', false])
  })

  it('без второго пути — только подтверждение и что дальше', async () => {
    const { section } = await render(thankYou.props(landing(), 'confirmation'))
    expect(section?.querySelectorAll('a')).toHaveLength(0)
  })

  it('не имеет нарушений доступности', async () => {
    const { html } = await render(thankYou.props(strategyPage('thank-you', RU), 'confirmation'))
    await expectNoA11yViolations(html)
  })
})
