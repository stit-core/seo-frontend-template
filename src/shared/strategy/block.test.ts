import { testLocale } from '@/shared/lib/testing'
import {
  action,
  date,
  defineBlock,
  fact,
  group,
  labelled,
  list,
  media,
  text,
  unshown,
  untargeted,
} from './block'
import type { Section, StrategyPage } from './page'

const promo = defineBlock({
  id: 'promo',
  variants: ['split', 'stacked'],
  slots: {
    title: text,
    cta: action,
    'cta-label': text,
    note: text.optional(),
    point: list(text),
    company: fact.optional(),
    card: group({ title: text, link: action.optional() }),
  },
})

const company = { id: 'company-name', text: 'Студия «Демо»', machine: undefined, binds: [] }
const section = (change: Partial<Section> = {}): Section => ({
  id: 'offer',
  role: 'offer',
  block: 'promo',
  variant: 'split',
  slots: {
    title: 'Ремонт под ключ',
    cta: { href: '/contacts' },
    'cta-label': 'Оставить заявку',
    point: 'Смета за три дня',
    company,
  },
  groups: { card: [{ title: 'Замер' }, { title: 'Смета', link: { href: '/smeta' } }] },
  ...change,
})
const page = (...sections: Section[]): StrategyPage => ({
  id: 'home',
  url: '/',
  parents: [],
  meta: {
    title: 'Главная',
    description: 'Описание',
    ogTitle: undefined,
    ogDescription: undefined,
    ogImageAlt: undefined,
  },
  sections,
  policy: undefined,
  operator: undefined,
})

describe('strategy/block', () => {
  it('секция плана → пропсы блока: id секции, вариант, слоты по элементам анатомии, экземпляры групп', () => {
    expect(promo.props(page(section()), 'offer')).toStrictEqual({
      id: 'offer',
      variant: 'split',
      title: 'Ремонт под ключ',
      cta: { href: '/contacts' },
      'cta-label': 'Оставить заявку',
      point: ['Смета за три дня'],
      company,
      card: [{ title: 'Замер' }, { title: 'Смета', link: { href: '/smeta' } }],
    })
  })

  it('элемент, который план заполняет не раз, — список по порядку плана; пробел в фактах — без значения', () => {
    const repeated = section({
      slots: { ...section().slots, point: ['Замер', 'Смета'], company: undefined },
    })
    expect(promo.props(page(repeated), 'offer')).toMatchObject({
      point: ['Замер', 'Смета'],
      company: undefined,
    })
  })

  it('другой блок или секции нет в плане — ошибка называет секцию', () => {
    expect(() => promo.props(page(section()), 'hero')).toThrow(
      'strategy: home/hero — секции нет в плане',
    )
    expect(() => promo.props(page(section({ block: 'hero-text' })), 'offer')).toThrow(
      'strategy: home/offer — в плане блок hero-text, а не promo',
    )
  })

  it('вариант не из блока, слот вне анатомии блока или без значения, не тот вид значения — ошибка называет слот', () => {
    const { title: _title, ...untitled } = section().slots
    const cases: Array<[Partial<Section>, string]> = [
      [{ variant: 'marquee' }, '→ at variant'],
      [{ slots: { ...section().slots, eyebrow: 'Новое' } }, 'Unrecognized key: "eyebrow"'],
      [{ slots: untitled }, '→ at title'],
      [{ slots: { ...section().slots, title: ['Ремонт', 'Отделка'] } }, '→ at title'],
      [{ slots: { ...section().slots, cta: { href: undefined } } }, '→ at cta.href'],
      [{ slots: { ...section().slots, company: 'Студия' } }, '→ at company'],
      [{ groups: { card: [{ title: 'Замер', body: 'Приедем' }] } }, '→ at card[0]'],
      [{ groups: {} }, '→ at card'],
    ]
    for (const [change, where] of cases) {
      const run = () => promo.props(page(section(change)), 'offer')
      expect(run, where).toThrow('strategy: home/offer — блок promo: ')
      expect(run, where).toThrow(where)
    }
  })

  // Переключатель языка — место действия без цели; медиа-слот чтение не заполняет; цель на основном языке — с его кодом.
  it('действие без цели, медиа-слот и язык цели — свои виды значения', () => {
    const chrome = defineBlock({
      id: 'header',
      variants: ['site-nav'],
      slots: { logo: media, 'lang-switch': untargeted.optional(), cta: action.optional() },
    })
    const header = (slots: Section['slots']) =>
      chrome.props(
        page(section({ id: 'header', block: 'header', variant: 'site-nav', slots, groups: {} })),
        'header',
      )
    expect(
      header({
        'lang-switch': { href: undefined },
        cta: { href: '/legal/privacy', hreflang: testLocale('ru') },
      }),
    ).toStrictEqual({
      id: 'header',
      variant: 'site-nav',
      'lang-switch': { href: undefined },
      cta: { href: '/legal/privacy', hreflang: 'ru' },
    })
    expect(() => header({ 'lang-switch': { href: '/en' } })).toThrow('→ at ["lang-switch"].href')
    expect(() => header({ logo: 'logo.svg' })).toThrow('→ at logo')
  })

  // Успех формы без JS — страница «спасибо»: текст успеха блок принимает, а не показывает; дату записи кладёт страница.
  it('текст, который блок не показывает, — текст плана; дата записи коллекции — дата, а не текст', () => {
    const form = defineBlock({
      id: 'lead-form',
      variants: ['short'],
      slots: { title: text, success: unshown.optional() },
    })
    const lead = (slots: Section['slots']) =>
      form.props(
        page(section({ id: 'form', block: 'lead-form', variant: 'short', slots, groups: {} })),
        'form',
      )
    expect(lead({ title: 'Заявка', success: 'Заявка у нас' })).toStrictEqual({
      id: 'form',
      variant: 'short',
      title: 'Заявка',
      success: 'Заявка у нас',
    })
    expect(() => lead({ title: 'Заявка', success: { href: '/spasibo' } })).toThrow('→ at success')
    expect(date.safeParse(new Date('2026-09-01')).success).toBe(true)
    expect(date.safeParse('1 сентября 2026').success).toBe(false)
  })

  it('действия и подписи — пары по порядку плана; у пары нет половины — ошибка называет ключ', () => {
    const links = [{ href: '/privacy' }, { href: '/soglasie' }]
    expect(labelled(links, ['Политика', 'Согласие'], 'home/footer/privacy')).toEqual([
      { href: '/privacy', label: 'Политика' },
      { href: '/soglasie', label: 'Согласие' },
    ])
    expect(() => labelled(links, ['Политика'], 'home/footer/privacy')).toThrow(
      'strategy: home/footer/privacy — действий 2, а подписей 1',
    )
    expect(() => labelled(links.slice(1), ['Политика', 'Согласие'], 'home/footer/privacy')).toThrow(
      'strategy: home/footer/privacy — действий 1, а подписей 2',
    )
  })
})
