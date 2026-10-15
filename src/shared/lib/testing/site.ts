import type * as Strategy from '@/shared/strategy'

// Тексты каркаса главной теста на языке: шапка (меню — подписи пунктов карты по порядку) и подвал (реквизиты,
// правовая ссылка, почта, разделы).
const homeDeck = (lang: string, nav: readonly string[], legal: string, privacy: string) => ({
  copy_deck: {
    lang,
    pages: [
      {
        page_id: 'home',
        meta: { title: `Главная теста (${lang})`, description: `Описание главной теста (${lang})` },
        sections: [
          {
            section_id: 'header',
            slots: nav.map((text, index) => ({
              slot_id: `nav-link-${index + 1}`,
              variants: [{ id: 'a', text }],
            })),
          },
          {
            section_id: 'footer',
            slots: [
              { slot_id: 'legal', variants: [{ id: 'a', text: legal }] },
              { slot_id: 'privacy-label', variants: [{ id: 'a', text: privacy }] },
              ...nav.map((text, index) => ({
                slot_id: `nav-${index + 1}-label`,
                variants: [{ id: 'a', text }],
              })),
            ],
          },
        ],
      },
    ],
  },
})

const factsOf = (lang: string, name: string) => ({
  lang,
  facts: [{ id: 'company-name', verbatim: [name] }],
})

const NAV = ['/blog', '/about', '/contacts'] as const

// Проект strategy теста в раскладке снимка — карта на локалях теста (TEST_LOCALES): главная и «О компании» — на ru, en
// и de, контакты, «спасибо» и блог — на ru и en, политика ПДн — только на ru; крошки — у записи и тега; меню шапки —
// блог, «О компании», контакты. План главной — её каркас: шапка сайта и подвал сайта, тексты и факты — на трёх языках.
// Страницы, языки, переводы и каркас тест судит по нему, а не по данным сайта.
export const TEST_SITE = {
  'facts.yaml': factsOf('ru', 'ООО «Тест»'),
  'facts.en.yaml': factsOf('en', 'Test LLC'),
  'facts.de.yaml': factsOf('de', 'Test GmbH'),
  'site/test/site-map.yaml': {
    languages: {
      primary: 'ru',
      versions: [
        { lang: 'ru', scope: 'all-pages' },
        {
          lang: 'en',
          scope: 'selected-pages',
          pages: ['home', 'about', 'contacts', 'thank-you', 'blog', 'post', 'tag'],
        },
        { lang: 'de', scope: 'selected-pages', pages: ['home', 'about'] },
      ],
    },
    templates: [
      { id: 'home', breadcrumbs: false },
      { id: 'about', breadcrumbs: false },
      { id: 'contacts', breadcrumbs: false },
      { id: 'thank-you', breadcrumbs: false },
      { id: 'legal', breadcrumbs: false },
      { id: 'blog', breadcrumbs: false },
      { id: 'post', breadcrumbs: true },
      { id: 'tag', breadcrumbs: true },
    ],
    pages: [
      { id: 'home', template: 'home', url: '/', parent: null },
      { id: 'about', template: 'about', url: '/about', parent: 'home' },
      { id: 'contacts', template: 'contacts', url: '/contacts', parent: 'home' },
      { id: 'thank-you', template: 'thank-you', url: '/contacts/spasibo', parent: 'contacts' },
      {
        id: 'privacy',
        template: 'legal',
        url: '/legal/privacy',
        parent: null,
        lang_versions: ['ru'],
      },
      { id: 'blog', template: 'blog', url: '/blog', parent: 'home' },
      { id: 'post', template: 'post', url: '/blog/{slug}', parent: 'blog' },
      { id: 'tag', template: 'tag', url: '/blog/tag/{slug}', parent: 'blog' },
    ],
    chrome: { header: { items: [{ page: 'blog' }, { page: 'about' }, { page: 'contacts' }] } },
  },
  'site/test/plans/home.yaml': {
    page: { id: 'home' },
    sections: [
      {
        id: 'header',
        role: 'header',
        block: 'header',
        variant: 'site-nav',
        slots: {
          text: NAV.map((_, index) => ({ id: `nav-link-${index + 1}`, anatomy: 'nav-link' })),
          action: [{ id: 'lang-switch' }],
        },
      },
      {
        id: 'footer',
        role: 'footer',
        block: 'footer',
        variant: 'site',
        slots: {
          text: [
            { id: 'legal' },
            { id: 'privacy-label' },
            ...NAV.map((_, index) => ({
              id: `nav-${index + 1}-label`,
              anatomy: 'nav.label',
              group: `nav-${index + 1}`,
            })),
          ],
          data: [{ id: 'company', anatomy: 'company', fact: 'fact:company-name' }],
          action: [
            { id: 'privacy', target: { kind: 'route', value: '/legal/privacy' } },
            { id: 'email', target: { kind: 'url', value: 'mailto:test@example.com' } },
            ...NAV.map((route, index) => ({
              id: `nav-${index + 1}-link`,
              anatomy: 'nav.link',
              group: `nav-${index + 1}`,
              target: { kind: 'route', value: route },
            })),
          ],
        },
      },
    ],
  },
  'site/test/copy/home.yaml': homeDeck(
    'ru',
    ['Заметки', 'О студии', 'Связаться'],
    'ООО «Тест», ОГРН 1000000000002',
    'Политика теста',
  ),
  'site/test/copy/home.en.yaml': homeDeck(
    'en',
    ['Notes', 'Studio', 'Reach us'],
    'Test LLC, OGRN 1000000000002',
    'Test policy',
  ),
  'site/test/copy/home.de.yaml': homeDeck(
    'de',
    ['Notizen', 'Studio', 'Kontakt'],
    'Test GmbH, OGRN 1000000000002',
    'Datenschutz',
  ),
}

// Модуль `@/shared/strategy` на проекте теста — фабрика `vi.mock` (вместе с локалями теста `withTestLocales`).
export async function withTestSite(importOriginal: () => Promise<unknown>) {
  const strategy = (await importOriginal()) as typeof Strategy
  return { ...strategy, ...strategy.siteOf(strategy.projectOf(TEST_SITE)) }
}
