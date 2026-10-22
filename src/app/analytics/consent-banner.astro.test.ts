import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { ISLANDS } from '@/shared/config'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, t } from '@/shared/i18n'
import { expectNoA11yViolations, parseHtml } from '@/shared/lib/testing'
import ConsentBanner from './consent-banner.astro'

const container = await AstroContainer.create()
// Политика ПДн плана — по адресу, которого нет у шаблона: ссылка баннера — адрес плана, а не литерал.
const render = (
  locale = DEFAULT_LOCALE,
  policy: { href: string; hreflang?: string } = { href: '/legal/pd' },
) => container.renderToString(ConsentBanner, { props: { locale, policy } })

describe('ConsentBanner', () => {
  // Без JS выбор не сохранить и счётчик не включить: баннер, который ничего не меняет, не показывается.
  it('печатается скрытым: открывает его остров согласия', async () => {
    const region = parseHtml(await render()).querySelector('[data-consent-banner]')
    expect(region?.hasAttribute('hidden')).toBe(true)
  })

  // Анатомия блока cookie-banner каталога: немодальная область с подписью; «Отклонить» — того же вида, что «Принять», на
  // первом уровне, а не ссылка или пункт настроек.
  it.each(SUPPORTED_LOCALES)(
    'область с подписью: текст, ссылка на политику, «Принять» и «Отклонить» — кнопки одного вида (%s)',
    async (locale) => {
      const region = parseHtml(await render(locale)).querySelector('[data-consent-banner]')
      // `<section>` с подписью — лендмарк region, как у элемента каталога.
      expect([region?.tagName, region?.getAttribute('aria-label')]).toEqual([
        'SECTION',
        t(locale, 'consent.label'),
      ])
      const buttons = [...(region?.querySelectorAll('button') ?? [])]
      expect(
        buttons.map((button) => [
          button.getAttribute('type'),
          button.getAttribute('data-consent'),
          button.textContent?.trim(),
        ]),
      ).toEqual([
        ['button', 'accept', t(locale, 'consent.accept')],
        ['button', 'reject', t(locale, 'consent.reject')],
      ])
      expect(new Set(buttons.map((button) => button.getAttribute('class'))).size).toBe(1)
      const link = region?.querySelector('a')
      expect([link?.getAttribute('href'), link?.hasAttribute('hreflang')]).toEqual([
        '/legal/pd',
        false,
      ])
      // Весь текст баннера — микрокопия словаря на языке страницы: каждый текст — свой элемент, других букв нет.
      const texts = [...(region?.querySelectorAll('p, button') ?? [])].map((element) =>
        element.textContent?.trim(),
      )
      expect(texts).toEqual([
        t(locale, 'consent.text'),
        t(locale, 'consent.policy'),
        t(locale, 'consent.accept'),
        t(locale, 'consent.reject'),
      ])
      expect(region?.textContent?.replace(/\s/g, '')).toBe(texts.join('').replace(/\s/g, ''))
    },
  )

  it('политика без версии на языке страницы — ссылка на версию другого языка с её hreflang', async () => {
    const link = parseHtml(
      await render(DEFAULT_LOCALE, { href: '/legal/pd', hreflang: 'xx' }),
    ).querySelector('[data-consent-banner] a')
    expect([link?.getAttribute('href'), link?.getAttribute('hreflang')]).toEqual([
      '/legal/pd',
      'xx',
    ])
  })

  // Разметку острова seo:check узнаёт по атрибутам его строки: баннер без острова на странице — нарушение.
  it('атрибуты, которые обслуживает остров, — разметка его строки реестра', async () => {
    const attributes = [...(await render()).matchAll(/\s(data-consent[\w-]*)/g)].map(
      ([, name]) => name,
    )
    expect([...new Set(attributes)].sort()).toEqual([...(ISLANDS.metrika.markup ?? [])].sort())
  })

  it('открытый баннер — без нарушений axe', async () => {
    const html = (await render()).replace(/\shidden(?=[\s>])/, '')
    expect(parseHtml(html).querySelector('[data-consent-banner]')?.hasAttribute('hidden')).toBe(
      false,
    )
    await expectNoA11yViolations(html)
  })
})
