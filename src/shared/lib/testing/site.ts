import type * as Strategy from '@/shared/strategy'

// Проект strategy теста в раскладке снимка — карта на локалях теста (TEST_LOCALES): главная и «О компании» — на ru, en
// и de, контакты, «спасибо» и блог — на ru и en, политика ПДн — только на ru. Страницы, языки и переводы тест судит по
// ней, а не по карте сайта.
export const TEST_SITE = {
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
    pages: [
      { id: 'home', url: '/', parent: null },
      { id: 'about', url: '/about', parent: 'home' },
      { id: 'contacts', url: '/contacts', parent: 'home' },
      { id: 'thank-you', url: '/contacts/spasibo', parent: 'contacts' },
      { id: 'privacy', url: '/legal/privacy', parent: null, lang_versions: ['ru'] },
      { id: 'blog', url: '/blog', parent: 'home' },
      { id: 'post', url: '/blog/{slug}', parent: 'blog' },
      { id: 'tag', url: '/blog/tag/{slug}', parent: 'blog' },
    ],
  },
}

// Модуль `@/shared/strategy` на проекте теста — фабрика `vi.mock` (вместе с локалями теста `withTestLocales`).
export async function withTestSite(importOriginal: () => Promise<unknown>) {
  const strategy = (await importOriginal()) as typeof Strategy
  return { ...strategy, ...strategy.siteOf(strategy.projectOf(TEST_SITE)) }
}
