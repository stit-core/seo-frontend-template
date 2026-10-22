import type * as Strategy from '@/shared/strategy'

// Текст страницы теста на языке: строка русской версии, у другого языка — с его кодом в скобках.
const say = (lang: string, text: string) => (lang === 'ru' ? text : `${text} (${lang})`)

const slotsOf = (texts: Readonly<Record<string, string>>) =>
  Object.entries(texts).map(([slot_id, text]) => ({ slot_id, variants: [{ id: 'a', text }] }))

// Copy deck страницы теста на языке: тексты секций по id слота.
const deckOf = (
  lang: string,
  page: string,
  sections: Readonly<Record<string, Readonly<Record<string, string>>>>,
) => ({
  copy_deck: {
    lang,
    pages: [
      {
        page_id: page,
        meta: {
          title: say(lang, `Страница ${page} теста`),
          description: say(lang, `Описание страницы ${page} теста`),
        },
        sections: Object.entries(sections).map(([section_id, texts]) => ({
          section_id,
          slots: slotsOf(
            Object.fromEntries(
              Object.entries(texts).map(([slot, text]) => [slot, say(lang, text)]),
            ),
          ),
        })),
      },
    ],
  },
})

// Тексты главной теста на языке: каркас — шапка (меню — подписи пунктов карты по порядку) и подвал (реквизиты,
// правовая ссылка, почта, разделы), — и секция свежих записей.
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
            slots: slotsOf(
              Object.fromEntries(nav.map((text, index) => [`nav-link-${index + 1}`, text])),
            ),
          },
          {
            section_id: 'related',
            slots: slotsOf({
              title: say(lang, 'Свежие записи'),
              'all-label': say(lang, 'Все записи'),
            }),
          },
          {
            section_id: 'footer',
            slots: slotsOf({
              legal,
              'privacy-label': privacy,
              ...Object.fromEntries(nav.map((text, index) => [`nav-${index + 1}-label`, text])),
            }),
          },
        ],
      },
    ],
  },
})

// Факты теста на языке: оператор и часы работы (их время — `machine`, строка — та, что называет copy deck).
const factsOf = (lang: string, name: string) => ({
  lang,
  facts: [
    { id: 'company-name', verbatim: [name] },
    {
      id: 'company-hours',
      verbatim: [say(lang, 'Пн–Пт, 10:00–19:00')],
      machine: {
        type: 'opening-hours',
        hours: [{ days: ['mo', 'tu', 'we', 'th', 'fr'], opens: '10:00', closes: '19:00' }],
      },
    },
    { id: 'policy-revision', verbatim: [say(lang, '1 октября 2026 года')] },
    {
      id: 'company-telegram',
      verbatim: ['t.me/test'],
      machine: { type: 'messenger', network: 'telegram', value: 'https://t.me/test' },
    },
  ],
})

// Мессенджер компании теста с готовым сообщением — текстом слота `messenger-prefill` своей секции.
const telegram = (id: string) => ({
  id,
  target: { kind: 'messenger', value: 'messenger:company-telegram', prefill: 'messenger-prefill' },
})

const NAV = ['/blog', '/about', '/contacts'] as const
const route = (value: string) => ({ kind: 'route', value })

// Тексты страниц под блоки секций — русская версия (у других языков — с кодом языка).
const ABOUT = {
  story: {
    title: 'О студии',
    'body-1': 'Студия делает сайты, которые видно в поиске.',
    'body-2': 'Тексты живут в git, страницы собираются заранее.',
    'point-1': 'Сайты-визитки и блоги',
    'point-2': 'Техническая сторона поиска',
  },
  details: {
    title: 'Реквизиты и контакты',
    'info-1': '101000, Москва, ул. Тестовая, 1',
    'info-2': 'Пн–Пт, 10:00–19:00',
    legal: 'ООО «Тест», ОГРН 1000000000002',
    'messenger-prefill': 'Здравствуйте! Есть вопрос о сайте.',
  },
}
const CONTACTS = {
  request: {
    title: 'Заявка',
    lead: 'Напишите — ответим на почту.',
    'cta-label': 'Получить ответ',
    consent: 'Согласен на обработку персональных данных',
    'next-steps': 'Ответим в течение рабочего дня.',
    success: 'Заявка у нас.',
    'messenger-prefill': 'Здравствуйте! Хочу обсудить сайт.',
  },
}
const THANKS = {
  confirmation: {
    title: 'Заявка у нас',
    'next-steps': 'Ответим на почту в течение рабочего дня.',
    'secondary-label': 'Вернуться к контактам',
    'messenger-prefill': 'Здравствуйте! Отправил заявку на сайте.',
  },
}
const PRIVACY = {
  policy: {
    title: 'Политика теста',
    date: 'Редакция от 1 октября 2026 года',
    operator: 'ООО «Тест», ОГРН 1000000000002, Москва',
    'clause-1-heading': '1. Оператор',
    'clause-1-text-1': 'Данные обрабатывает ООО «Тест».',
    'clause-1-text-2': 'Вопросы — на почту оператора.',
    'clause-2-heading': '2. Какие данные',
    'clause-2-text-1': 'Имя и почта из формы.',
  },
}
// Блог: список — первый экран и записи; шаблоны записи и тега — тексты шаблона (крошки, заголовки секций, призыв),
// слоты записи даёт запись.
const BLOG = {
  hero: {
    headline: 'Заметки студии',
    subheadline: 'Пишем о сайтах, которые видно в поиске.',
    'cta-label': 'Написать нам',
  },
  related: { title: 'Все записи' },
}
const CRUMBS = { 'crumb-1-label': 'Начало', 'crumb-2-label': 'Заметки' }
const POST = { breadcrumbs: CRUMBS, related: { title: 'Ещё по теме' } }
const TAG = {
  breadcrumbs: CRUMBS,
  hero: { 'cta-label': 'Написать нам' },
  related: { title: 'Записи тега' },
}
const NOT_FOUND = {
  'not-found': {
    title: 'Страницы нет',
    body: 'Проверьте адрес или откройте раздел.',
    'cta-label': 'На главную теста',
    'route-1-label': 'Заметки',
    'route-2-label': 'О студии',
    'route-3-label': 'Связаться',
  },
}

// Секции страниц блога: крошки шаблонов (текущая ступень — запись), первый экран и список записей.
const crumbsSection = {
  id: 'breadcrumbs',
  role: 'header',
  block: 'breadcrumbs',
  variant: 'full-path',
  slots: {
    text: [
      { id: 'current' },
      ...['crumb-1', 'crumb-2'].map((group) => ({
        id: `${group}-label`,
        anatomy: 'crumb.label',
        group,
      })),
    ],
    action: [
      { id: 'crumb-1-link', anatomy: 'crumb.link', group: 'crumb-1', target: route('/') },
      { id: 'crumb-2-link', anatomy: 'crumb.link', group: 'crumb-2', target: route('/blog') },
    ],
  },
}
const heroSection = {
  id: 'hero',
  role: 'hero',
  block: 'hero-text',
  variant: 'statement-cta',
  slots: {
    text: [{ id: 'headline' }, { id: 'subheadline' }, { id: 'cta-label' }],
    action: [{ id: 'cta', target: route('/contacts') }],
  },
}
const cardsSection = {
  id: 'related',
  role: 'related',
  block: 'article-cards',
  variant: 'list',
  slots: { text: [{ id: 'title' }] },
}

// Проект strategy теста в раскладке снимка — карта на локалях теста (TEST_LOCALES): главная, «О компании» и 404 — на
// ru, en и de, контакты, «спасибо» и блог — на ru и en, политика ПДн — только на ru; крошки — у записи и тега,
// связанные записи — по общему тегу; меню шапки — блог, «О компании», контакты. План главной — её каркас (шапка сайта и
// подвал сайта) и свежие записи; планы страниц — секции блоков каталога: «О компании» — текстовый раздел и контакты,
// контакты — форма, «спасибо», политика, 404 с путями на разделы, блог — первый экран и записи; шаблоны записи и тега —
// крошки, тело записи и связанные, первый экран и записи тега. Страницы, языки, переводы, каркас и блоки тест судит по
// нему, а не по данным сайта.
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
          pages: ['home', 'about', 'contacts', 'thank-you', 'not-found', 'blog', 'post', 'tag'],
        },
        { lang: 'de', scope: 'selected-pages', pages: ['home', 'about', 'not-found'] },
      ],
    },
    templates: [
      { id: 'home', breadcrumbs: false },
      { id: 'about', breadcrumbs: false },
      { id: 'contacts', breadcrumbs: false },
      { id: 'thank-you', breadcrumbs: false },
      { id: 'legal', breadcrumbs: false },
      { id: 'not-found', breadcrumbs: false },
      { id: 'blog', breadcrumbs: false },
      { id: 'post', breadcrumbs: true, related: 'post-tags' },
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
      { id: 'not-found', template: 'not-found', url: '/404', parent: null },
      { id: 'blog', template: 'blog', url: '/blog', parent: 'home' },
      { id: 'post', template: 'post', url: '/blog/{slug}', parent: 'blog' },
      { id: 'tag', template: 'tag', url: '/blog/tag/{slug}', parent: 'blog' },
    ],
    chrome: { header: { items: [{ page: 'blog' }, { page: 'about' }, { page: 'contacts' }] } },
    linking: { related_rules: [{ id: 'post-tags', by: 'shared-tag', max: 3 }] },
  },
  'site/test/plans/home.yaml': {
    page: { id: 'home', page_type: 'home-multipage' },
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
        id: 'related',
        role: 'related',
        block: 'article-cards',
        variant: 'list',
        slots: {
          text: [{ id: 'title' }, { id: 'all-label' }],
          action: [{ id: 'all', target: route('/blog') }],
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
          data: [
            { id: 'company', anatomy: 'company', fact: 'fact:company-name', binds: ['legal'] },
          ],
          action: [
            { id: 'privacy', target: route('/legal/privacy') },
            { id: 'email', target: { kind: 'url', value: 'mailto:test@example.com' } },
            ...NAV.map((value, index) => ({
              id: `nav-${index + 1}-link`,
              anatomy: 'nav.link',
              group: `nav-${index + 1}`,
              target: route(value),
            })),
          ],
        },
      },
    ],
  },
  'site/test/plans/about.yaml': {
    page: { id: 'about', page_type: 'about-page' },
    sections: [
      {
        id: 'story',
        role: 'about',
        block: 'prose',
        variant: 'story',
        slots: {
          text: [
            { id: 'title' },
            { id: 'body-1', anatomy: 'body' },
            { id: 'body-2', anatomy: 'body' },
            { id: 'point-1', anatomy: 'point' },
            { id: 'point-2', anatomy: 'point' },
          ],
        },
      },
      {
        id: 'details',
        role: 'contacts',
        block: 'contact-details',
        variant: 'compact',
        slots: {
          text: [
            { id: 'title' },
            { id: 'info-1', anatomy: 'info' },
            { id: 'info-2', anatomy: 'info' },
            { id: 'legal' },
            { id: 'messenger-prefill' },
          ],
          action: [
            { id: 'phone', target: { kind: 'tel', value: 'tel:+70000000000' } },
            { id: 'email', target: { kind: 'url', value: 'mailto:test@example.com' } },
            telegram('messenger'),
          ],
          data: [
            { id: 'company', anatomy: 'company', fact: 'fact:company-name', binds: ['legal'] },
            { id: 'hours', anatomy: 'company', fact: 'fact:company-hours', binds: ['info-2'] },
          ],
        },
      },
    ],
  },
  'site/test/plans/contacts.yaml': {
    page: {
      id: 'contacts',
      page_type: 'contacts-page',
      legal: { privacy_policy: '/legal/privacy' },
    },
    sections: [
      {
        id: 'request',
        role: 'lead-form',
        block: 'lead-form',
        variant: 'with-details',
        slots: {
          text: Object.keys(CONTACTS.request).map((id) => ({ id })),
          action: [
            {
              id: 'form',
              form: { ref: 'lead-forms.yaml#contact-message', thank_you_page: '/contacts/spasibo' },
            },
            telegram('messenger'),
          ],
        },
      },
    ],
  },
  'site/test/plans/thank-you.yaml': {
    page: { id: 'thank-you', page_type: 'thank-you-page' },
    sections: [
      {
        id: 'confirmation',
        role: 'confirmation',
        block: 'thank-you',
        variant: 'page',
        slots: {
          text: Object.keys(THANKS.confirmation).map((id) => ({ id })),
          action: [{ id: 'secondary', target: route('/contacts') }, telegram('channels')],
        },
      },
    ],
  },
  'site/test/plans/privacy.yaml': {
    page: { id: 'privacy', page_type: 'legal-page', seo: { h1: 'policy.title' } },
    sections: [
      {
        id: 'policy',
        role: 'legal',
        block: 'legal-text',
        variant: 'privacy-policy',
        slots: {
          text: [
            { id: 'title' },
            { id: 'date' },
            { id: 'operator' },
            { id: 'clause-1-heading', anatomy: 'clause.heading', group: 'clause-1' },
            { id: 'clause-1-text-1', anatomy: 'clause.text', group: 'clause-1' },
            { id: 'clause-1-text-2', anatomy: 'clause.text', group: 'clause-1' },
            { id: 'clause-2-heading', anatomy: 'clause.heading', group: 'clause-2' },
            { id: 'clause-2-text-1', anatomy: 'clause.text', group: 'clause-2' },
          ],
          data: [
            { id: 'company', anatomy: 'company', fact: 'fact:company-name', binds: ['operator'] },
            { id: 'revision', fact: 'fact:policy-revision', binds: ['date'] },
          ],
        },
      },
    ],
  },
  'site/test/plans/not-found.yaml': {
    page: { id: 'not-found', page_type: 'not-found-page' },
    sections: [
      {
        id: 'not-found',
        role: 'not-found',
        block: 'not-found',
        variant: 'with-routes',
        slots: {
          text: [
            { id: 'title' },
            { id: 'body' },
            { id: 'cta-label' },
            ...NAV.map((_, index) => ({
              id: `route-${index + 1}-label`,
              anatomy: 'route.label',
              group: `route-${index + 1}`,
            })),
          ],
          action: [
            { id: 'cta', target: route('/') },
            ...NAV.map((value, index) => ({
              id: `route-${index + 1}-link`,
              anatomy: 'route.link',
              group: `route-${index + 1}`,
              target: route(value),
            })),
          ],
        },
      },
    ],
  },
  'site/test/plans/blog.yaml': {
    page: { id: 'blog', page_type: 'blog-index-page' },
    sections: [heroSection, cardsSection],
  },
  'site/test/plans/post.yaml': {
    page: { id: 'post', page_type: 'article-page', template: true },
    sections: [
      crumbsSection,
      {
        id: 'article-body',
        role: 'article-body',
        block: 'article-body',
        variant: 'longread',
        slots: {
          text: [{ id: 'title' }, { id: 'lead' }, { id: 'date' }, { id: 'author' }, { id: 'alt' }],
          media: [{ id: 'cover' }],
        },
      },
      {
        id: 'related',
        role: 'related',
        block: 'related-links',
        variant: 'list',
        slots: { text: [{ id: 'title' }] },
      },
    ],
  },
  'site/test/plans/tag.yaml': {
    page: { id: 'tag', page_type: 'blog-index-page', template: true },
    sections: [crumbsSection, heroSection, cardsSection],
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
  ...Object.fromEntries(
    (
      [
        ['about', ABOUT, ['ru', 'en', 'de']],
        ['contacts', CONTACTS, ['ru', 'en']],
        ['thank-you', THANKS, ['ru', 'en']],
        ['privacy', PRIVACY, ['ru']],
        ['not-found', NOT_FOUND, ['ru', 'en', 'de']],
        ['blog', BLOG, ['ru', 'en']],
        ['post', POST, ['ru', 'en']],
        ['tag', TAG, ['ru', 'en']],
      ] as const
    ).flatMap(([page, texts, langs]) =>
      langs.map((lang) => [
        `site/test/copy/${page}${lang === 'ru' ? '' : `.${lang}`}.yaml`,
        deckOf(lang, page, texts),
      ]),
    ),
  ),
}

// Модуль `@/shared/strategy` на проекте теста — фабрика `vi.mock` (вместе с локалями теста `withTestLocales`): страница,
// которую берут модулем её данных (`pageOf`, `templateOf`), — страница проекта теста с тем же id.
export async function withTestSite(importOriginal: () => Promise<unknown>) {
  const strategy = (await importOriginal()) as typeof Strategy
  const site = strategy.siteOf(strategy.projectOf(TEST_SITE))
  const testPage = (files: Strategy.PageFiles, locale: Parameters<typeof site.strategyPage>[1]) =>
    site.strategyPage(strategy.projectOf(files).plans[0]?.page.id ?? '', locale)
  return { ...strategy, ...site, pageOf: testPage, templateOf: testPage }
}
