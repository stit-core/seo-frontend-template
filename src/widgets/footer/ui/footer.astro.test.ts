import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { t } from '@/shared/i18n'
import {
  expectNoA11yViolations,
  PACKAGE_LANDING,
  parseHtml,
  testLocale,
} from '@/shared/lib/testing'
import { projectOf, siteOf, strategyPage } from '@/shared/strategy'
import { footer } from '../model/block'
import Footer from './footer.astro'

// Локали и проект теста: контакты и блог — на ru и en, у немецкой версии — главная и «О компании», политика ПДн —
// только на ru; подвал — секция плана главной теста.
vi.mock('@/shared/i18n', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestLocales(importOriginal),
)
vi.mock('@/shared/strategy', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestSite(importOriginal),
)

const RU = testLocale('ru')
const EN = testLocale('en')
const DE = testLocale('de')

// Пропсы подвала — секция плана страницы: у сайта — главной теста, у посадочной — фикстуры базы package-landing.
const site = (locale = RU) => footer.props(strategyPage('home', locale), 'footer')
const minimal = () =>
  footer.props(siteOf(projectOf(PACKAGE_LANDING)).strategyPage('spasibo', RU), 'footer')

const render = async (props: Record<string, unknown>) => {
  const container = await AstroContainer.create()
  const html = await container.renderToString(Footer, { props })
  return { html, doc: parseHtml(html) }
}
type Doc = Awaited<ReturnType<typeof render>>['doc']

const links = (doc: Doc) =>
  [...doc.querySelectorAll('nav a')].map((link) => [
    link.getAttribute('href'),
    link.getAttribute('hreflang'),
    link.textContent,
  ])

describe('Footer', () => {
  it('подвал сайта: реквизиты — текст плана, почта — ссылкой в address, разделы и правовая ссылка — по плану', async () => {
    const { html, doc } = await render({ ...site(), locale: RU })
    expect(doc.querySelector('footer p')?.textContent).toBe('ООО «Тест», ОГРН 1000000000002')
    const mail = doc.querySelector('footer address a')
    expect([mail?.getAttribute('href'), mail?.textContent]).toEqual([
      'mailto:test@example.com',
      'test@example.com',
    ])
    expect(doc.querySelector('nav')?.getAttribute('aria-label')).toBe(t(RU, 'footer.links'))
    expect(links(doc)).toEqual([
      ['/blog', null, 'Заметки'],
      ['/about', null, 'О студии'],
      ['/contacts', null, 'Связаться'],
      ['/legal/privacy', null, 'Политика теста'],
    ])
    expect(html).not.toContain('<script')
  })

  // Политика ПДн есть только на основном языке: ссылка ведёт на неё и называет её язык.
  it('в другой локали — разделы её версии, документ без перевода — версия основного языка с hreflang', async () => {
    const en = await render({ ...site(EN), locale: EN })
    expect(en.doc.querySelector('footer p')?.textContent).toBe('Test LLC, OGRN 1000000000002')
    expect(links(en.doc)).toEqual([
      ['/en/blog', null, 'Notes'],
      ['/en/about', null, 'Studio'],
      ['/en/contacts', null, 'Reach us'],
      ['/legal/privacy', 'ru', 'Test policy'],
    ])
    // У немецкой версии нет блога и контактов: разделов основного языка в её подвале нет.
    expect(links((await render({ ...site(DE), locale: DE })).doc)).toEqual([
      ['/de/about', null, 'Studio'],
      ['/legal/privacy', 'ru', 'Datenschutz'],
    ])
  })

  it('подвал посадочной (фикстура базы): реквизиты и правовая ссылка плана, разделов и почты нет', async () => {
    const { doc } = await render({ ...minimal(), locale: RU })
    expect(doc.querySelector('footer p')?.textContent).toBe(
      'Студия ремонта «Отвес», Нижний Новгород',
    )
    expect(doc.querySelector('address')).toBeNull()
    expect(links(doc)).toEqual([['#lead-form', null, 'Политика обработки персональных данных']])
  })

  it('у правовой ссылки нет подписи или подписи нет ссылки — ошибка называет ключ', async () => {
    const props = { ...site(), locale: RU }
    await expect(render({ ...props, 'privacy-label': [] })).rejects.toThrow(
      'strategy: footer/privacy — действий 1, а подписей 0',
    )
    await expect(render({ ...props, 'privacy-label': ['Политика', 'Согласие'] })).rejects.toThrow(
      'strategy: footer/privacy — действий 1, а подписей 2',
    )
  })

  it('не имеет нарушений доступности: подвал сайта и посадочной', async () => {
    for (const props of [
      { ...site(), locale: RU },
      { ...minimal(), locale: RU },
    ]) {
      await expectNoA11yViolations((await render(props)).html)
    }
  })
})
