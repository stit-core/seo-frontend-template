import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { testLocale } from '@/shared/lib/testing'
import deck from './package-landing/site/promo/copy/spasibo.yaml'
import plan from './package-landing/site/promo/plans/spasibo.yaml'
import { languagesOf, linkOf, localesOf, projectOf, readPage, versionsOf } from './page'

// Чтение проверяется на локалях теста — ru, en и de, — а не на локалях сайта: фикстура проекта от них не зависит.
// Снимок сайта — на дескрипторе сайта (snapshot.test.ts).
vi.mock('@/shared/i18n', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestLocales(importOriginal),
)

// Проект в раскладке снимка: страница услуги под главной и разделом, на двух языках.
const site = () => ({
  'facts.yaml': {
    lang: 'ru',
    facts: [
      {
        id: 'phone',
        verbatim: ['+7 900 000-00-01'],
        machine: { type: 'telephone', value: '+79000000001' },
      },
      {
        id: 'chat',
        verbatim: ['Написать в MAX'],
        machine: { type: 'messenger', network: 'max', value: 'https://max.ru/demo' },
      },
      { id: 'studio', verbatim: ['Студия «Демо»'] },
    ],
  },
  'facts.en.yaml': {
    lang: 'en-GB',
    facts: [
      {
        id: 'phone',
        verbatim: ['+7 900 000-00-01'],
        machine: { type: 'telephone', value: '+79000000001' },
      },
      {
        id: 'chat',
        verbatim: ['Message us on MAX'],
        machine: { type: 'messenger', network: 'max', value: 'https://max.ru/demo' },
      },
      { id: 'studio', verbatim: ['Demo studio'] },
    ],
  },
  'site/web/site-map.yaml': {
    languages: {
      primary: 'ru',
      versions: [
        { lang: 'ru', scope: 'all-pages' },
        { lang: 'en-GB', scope: 'all-pages' },
        { lang: 'de', scope: 'selected-pages', pages: ['home', 'repair'] },
      ],
    },
    pages: [
      { id: 'home', url: '/', parent: null },
      { id: 'services', url: '/uslugi', parent: 'home' },
      { id: 'repair', url: '/uslugi/remont', parent: 'services' },
    ],
  },
  'site/web/plans/repair.yaml': {
    page: { id: 'repair' },
    sections: [
      {
        id: 'hero',
        role: 'hero',
        block: 'hero-text',
        variant: 'statement-cta',
        slots: {
          text: [{ id: 'headline' }, { id: 'cta-label' }],
          action: [
            { id: 'cta', target: { kind: 'route', value: '/kontakty' }, label: 'cta-label' },
            { id: 'chat', target: { kind: 'messenger', value: 'messenger:chat' } },
            { id: 'lang-switch' },
          ],
        },
      },
      {
        id: 'steps',
        role: 'how-it-works',
        block: 'steps',
        slots: {
          text: [
            { id: 'step-1-title', anatomy: 'step.title', group: 'step-1' },
            { id: 'step-1-body', anatomy: 'step.body', group: 'step-1' },
            { id: 'step-2-title', anatomy: 'step.title', group: 'step-2' },
            { id: 'step-2-body', group: 'step-2' },
          ],
          data: [
            { id: 'step-2-phone', anatomy: 'step.phone', group: 'step-2', fact: 'fact:phone' },
          ],
        },
      },
      {
        id: 'footer',
        role: 'footer',
        block: 'footer',
        variant: 'minimal',
        slots: {
          data: [
            { id: 'company', fact: 'fact:studio' },
            { id: 'requisites', fact: 'missing:legal-details' },
          ],
        },
      },
    ],
  },
  'site/web/copy/repair.yaml': {
    copy_deck: {
      lang: 'ru',
      pages: [
        {
          page_id: 'repair',
          meta: {
            title: 'Ремонт под ключ — Студия «Демо»',
            description: 'Ремонт квартир под ключ.',
          },
          sections: [
            {
              section_id: 'hero',
              slots: [
                {
                  slot_id: 'headline',
                  variants: [
                    { id: 'a', text: 'Ремонт за два месяца' },
                    { id: 'b', text: 'Ремонт под ключ' },
                  ],
                  chosen: 'b',
                },
                { slot_id: 'cta-label', variants: [{ id: 'a', text: 'Вызвать замерщика' }] },
              ],
            },
            {
              section_id: 'steps',
              slots: [
                { slot_id: 'step-1-title', variants: [{ id: 'a', text: 'Замер' }] },
                {
                  slot_id: 'step-1-body',
                  variants: [{ id: 'a', text: 'Приедем в удобный день.' }],
                },
                { slot_id: 'step-2-title', variants: [{ id: 'a', text: 'Смета' }] },
                { slot_id: 'step-2-body', variants: [{ id: 'a', text: 'Посчитаем за три дня.' }] },
              ],
            },
          ],
        },
      ],
    },
  },
  'site/web/copy/repair.en.yaml': {
    copy_deck: {
      lang: 'en',
      pages: [
        {
          page_id: 'repair',
          meta: {
            title: 'Turnkey renovation — Demo studio',
            description: 'Turnkey flat renovation.',
            og_title: 'Turnkey renovation',
            og_description: 'From survey to keys.',
            og_image_alt: 'A renovated kitchen',
          },
          sections: [
            {
              section_id: 'hero',
              slots: [
                { slot_id: 'headline', variants: [{ id: 'a', text: 'Turnkey renovation' }] },
                { slot_id: 'cta-label', variants: [{ id: 'a', text: 'Book a survey' }] },
              ],
            },
            {
              section_id: 'steps',
              slots: [
                { slot_id: 'step-1-title', variants: [{ id: 'a', text: 'Survey' }] },
                {
                  slot_id: 'step-1-body',
                  variants: [{ id: 'a', text: 'We come on a day you pick.' }],
                },
                { slot_id: 'step-2-title', variants: [{ id: 'a', text: 'Estimate' }] },
                { slot_id: 'step-2-body', variants: [{ id: 'a', text: 'Ready in three days.' }] },
              ],
            },
          ],
        },
      ],
    },
  },
})

type Files = ReturnType<typeof site>
const read = (files: Files, code: 'ru' | 'en' = 'ru') =>
  readPage(projectOf(files), 'repair', testLocale(code))
// Проект с правкой на копии.
const edited = (change: (files: Files) => void): Files => {
  const files = structuredClone(site())
  change(files)
  return files
}

describe('strategy/page', () => {
  it('секции плана по порядку: блок, вариант, тексты слотов, группы, действия и данные', () => {
    const page = read(site())
    expect(page.sections.map(({ id, block, variant }) => [id, block, variant])).toEqual([
      ['hero', 'hero-text', 'statement-cta'],
      ['steps', 'steps', undefined],
      ['footer', 'footer', 'minimal'],
    ])
    expect(page.sections[0]).toMatchObject({
      text: { headline: 'Ремонт под ключ', 'cta-label': 'Вызвать замерщика' },
      actions: {
        cta: { href: '/kontakty', label: 'Вызвать замерщика' },
        chat: { href: 'https://max.ru/demo', label: undefined },
        'lang-switch': { href: undefined, label: undefined },
      },
      groups: {},
    })
    // Экземпляр группы — по порядку плана, элементы — по анатомии; элемент без анатомии — по id слота.
    expect(page.sections[1]).toMatchObject({
      text: {},
      groups: {
        step: [
          { text: { title: 'Замер', body: 'Приедем в удобный день.' }, actions: {}, data: {} },
          {
            text: { title: 'Смета', 'step-2-body': 'Посчитаем за три дня.' },
            data: {
              phone: {
                id: 'phone',
                text: '+7 900 000-00-01',
                machine: { type: 'telephone', value: '+79000000001' },
              },
            },
          },
        ],
      },
    })
    // Факт без machine для кода — текст; пробел missing: — без значения.
    expect(page.sections[2]?.data).toEqual({
      company: { id: 'studio', text: 'Студия «Демо»', machine: undefined },
      requisites: undefined,
    })
  })

  it('язык страницы — свои copy deck, факты и мета; маршрут действия и адреса карты — с его префиксом', () => {
    const page = read(site(), 'en')
    expect(page).toMatchObject({
      id: 'repair',
      url: '/en/uslugi/remont',
      parents: [
        { id: 'home', url: '/en' },
        { id: 'services', url: '/en/uslugi' },
      ],
      meta: {
        title: 'Turnkey renovation — Demo studio',
        description: 'Turnkey flat renovation.',
        ogTitle: 'Turnkey renovation',
        ogDescription: 'From survey to keys.',
        ogImageAlt: 'A renovated kitchen',
      },
    })
    expect(page.sections[0]?.actions.cta).toEqual({ href: '/en/kontakty', label: 'Book a survey' })
    expect(page.sections[2]?.data.company?.text).toBe('Demo studio')
    expect(read(site()).meta).toEqual({
      title: 'Ремонт под ключ — Студия «Демо»',
      description: 'Ремонт квартир под ключ.',
      ogTitle: undefined,
      ogDescription: undefined,
      ogImageAlt: undefined,
    })
  })

  it('без карты (лендинг) — адрес из page.url плана, родителей нет', () => {
    const files = edited((files) => {
      Reflect.deleteProperty(files, 'site/web/site-map.yaml')
      Object.assign(files['site/web/plans/repair.yaml'].page, { url: '/remont' })
    })
    expect(read(files)).toMatchObject({ url: '/remont', parents: [] })
  })

  it('нет страницы, секции, текста, меты, факта или адреса — ошибка называет ключ', () => {
    const ruPages = (files: Files) => files['site/web/copy/repair.yaml'].copy_deck.pages
    const cases: Array<[string, (files: Files) => void]> = [
      [
        'strategy: repair — нет плана',
        (files) => Reflect.deleteProperty(files, 'site/web/plans/repair.yaml'),
      ],
      [
        'strategy: repair — нет страницы в copy deck ru',
        (files) => Reflect.deleteProperty(files, 'site/web/copy/repair.yaml'),
      ],
      [
        'strategy: repair/hero/headline — нет текста в copy deck ru',
        (files) => {
          for (const page of ruPages(files)) page.sections.shift()
        },
      ],
      [
        'strategy: repair/steps/step-2-body — нет текста в copy deck ru',
        (files) => {
          for (const page of ruPages(files)) page.sections.at(1)?.slots.pop()
        },
      ],
      [
        'strategy: repair/hero/cta-label — нет текста в copy deck ru',
        (files) => {
          for (const page of ruPages(files)) page.sections.at(0)?.slots.pop()
        },
      ],
      [
        'strategy: repair/meta/title — нет текста в copy deck ru',
        (files) => {
          for (const page of ruPages(files)) Reflect.deleteProperty(page.meta, 'title')
        },
      ],
      [
        'strategy: repair/meta/description — нет текста в copy deck ru',
        (files) => {
          for (const page of ruPages(files)) Reflect.deleteProperty(page.meta, 'description')
        },
      ],
      [
        'strategy: repair/footer/company — fact:studio нет в фактах ru',
        (files) => files['facts.yaml'].facts.pop(),
      ],
      [
        'strategy: repair/hero/chat — messenger:chat: у факта нет machine с адресом ссылки',
        (files) => files['facts.yaml'].facts.splice(1, 1),
      ],
      [
        'strategy: repair — страницы нет в карте',
        (files) => files['site/web/site-map.yaml'].pages.pop(),
      ],
      [
        'strategy: repair — родителя services нет в карте',
        (files) => files['site/web/site-map.yaml'].pages.splice(1, 1),
      ],
      [
        'strategy: repair — родители в карте замкнулись на services',
        (files) => {
          for (const page of files['site/web/site-map.yaml'].pages) {
            if (page.id === 'home') Object.assign(page, { parent: 'services' })
          }
        },
      ],
      [
        'strategy: repair — у страницы без карты нет page.url в плане',
        (files) => Reflect.deleteProperty(files, 'site/web/site-map.yaml'),
      ],
    ]
    for (const [message, change] of cases) {
      expect(() => read(edited(change)), message).toThrow(message)
    }
  })

  it('файл снимка не по форме strategy — ошибка называет файл; поверхность — одна', () => {
    const files = edited((files) => {
      Object.assign(files['site/web/plans/repair.yaml'], { sections: 'hero' })
    })
    expect(() => projectOf(files)).toThrow('strategy/site/web/plans/repair.yaml: ')
    expect(() =>
      projectOf({
        ...site(),
        'site/promo/plans/repair.yaml': site()['site/web/plans/repair.yaml'],
      }),
    ).toThrow('strategy/site: поверхностей 2 — сайт собирается из одной')
  })

  describe('локали страниц карты', () => {
    const project = () => projectOf(site())

    it('локали страницы — языки её версий в карте; язык карты вне дескриптора — ошибка', () => {
      expect(localesOf(project(), 'repair')).toEqual(['ru', 'en', 'de'])
      expect(localesOf(project(), 'services')).toEqual(['ru', 'en'])
      const french = edited((files) => {
        files['site/web/site-map.yaml'].languages.versions.push({ lang: 'fr', scope: 'all-pages' })
      })
      expect(() => localesOf(projectOf(french), 'home')).toThrow(
        'strategy: home — язык fr карты вне дескриптора локалей',
      )
      const landing = edited((files) => Reflect.deleteProperty(files, 'site/web/site-map.yaml'))
      expect(() => localesOf(projectOf(landing), 'repair')).toThrow('repair — нет карты сайта')
    })

    it('карта переводов страницы — её адрес на каждой локали версии, со своим префиксом', () => {
      expect(versionsOf(project(), 'repair')).toEqual({
        ru: '/uslugi/remont',
        en: '/en/uslugi/remont',
        de: '/de/uslugi/remont',
      })
      expect(versionsOf(project(), 'home')).toEqual({ ru: '/', en: '/en', de: '/de' })
    })

    it('ссылка на страницу карты: её версия на языке страницы, без неё — версия основного языка с его кодом', () => {
      expect(linkOf(project(), '/uslugi', testLocale('en'))).toEqual({
        href: '/en/uslugi',
        hreflang: undefined,
      })
      expect(linkOf(project(), '/uslugi', testLocale('de'))).toEqual({
        href: '/uslugi',
        hreflang: 'ru',
      })
      expect(linkOf(project(), '/net-takoy', testLocale('de'))).toBeUndefined()
      const withoutPrimary = edited((files) => {
        for (const page of files['site/web/site-map.yaml'].pages) {
          if (page.id === 'services') Object.assign(page, { lang_versions: ['en'] })
        }
      })
      expect(linkOf(projectOf(withoutPrimary), '/uslugi', testLocale('de'))).toBeUndefined()
    })

    it('переключатель — перевод на каждый другой язык; без перевода — главная языка или ничего по карте', () => {
      expect(languagesOf(project(), testLocale('ru'), versionsOf(project(), 'repair'))).toEqual([
        { locale: 'en', href: '/en/uslugi/remont', translation: true },
        { locale: 'de', href: '/de/uslugi/remont', translation: true },
      ])
      // У «услуг» нет немецкой версии: по умолчанию переключатель ведёт на немецкую главную.
      expect(languagesOf(project(), testLocale('en'), versionsOf(project(), 'services'))).toEqual([
        { locale: 'ru', href: '/uslugi', translation: true },
        { locale: 'de', href: '/de', translation: false },
      ])
      const hidden = edited((files) => {
        for (const version of files['site/web/site-map.yaml'].languages.versions) {
          Object.assign(version, { untranslated_fallback: 'hide-link' })
        }
      })
      expect(
        languagesOf(projectOf(hidden), testLocale('en'), versionsOf(project(), 'services')),
      ).toEqual([{ locale: 'ru', href: '/uslugi', translation: true }])
      const landing = edited((files) => Reflect.deleteProperty(files, 'site/web/site-map.yaml'))
      expect(languagesOf(projectOf(landing), testLocale('ru'), {})).toEqual([])
    })
  })

  // Фикстура базы strategy (scripts/tests/fixtures/package-landing скилла design-deep-dive, тег v0.2.2): план и
  // copy deck страницы «спасибо» лендинга без карты — в форме, которую пишет strategy, байт в байт.
  describe('фикстура базы package-landing', () => {
    it('файлы — копии фикстуры базы байт в байт', () => {
      const sha = (path: string) =>
        createHash('sha256')
          .update(readFileSync(join(import.meta.dirname, 'package-landing/site/promo', path)))
          .digest('hex')
      expect(sha('plans/spasibo.yaml')).toBe(
        'bf659955e251eabc0994d2e98b2e2af70cebdd993203a14cda2d30b20128614c',
      )
      expect(sha('copy/spasibo.yaml')).toBe(
        '2581080140d75c4969637d8e93f5b0219bc1a3726a56d9b8c26e800aeec891e8',
      )
    })

    it('страница читается без правки кода: секции, тексты выбранных вариантов, действия, мета', () => {
      const landing = projectOf({
        'site/promo/plans/spasibo.yaml': plan,
        'site/promo/copy/spasibo.yaml': deck,
      })
      expect(readPage(landing, 'spasibo', testLocale('ru'))).toEqual({
        id: 'spasibo',
        url: '/spasibo',
        parents: [],
        meta: {
          title: 'Заявка на замер принята — студия «Отвес»',
          description: 'Заявка на замер принята. Студия ремонта «Отвес», Нижний Новгород.',
          ogTitle: 'Заявка на замер принята',
          ogDescription: 'Прораб позвонит и договорится о дне замера.',
          ogImageAlt: undefined,
        },
        sections: [
          {
            id: 'header',
            role: 'header',
            block: 'header',
            variant: 'landing-minimal',
            text: { 'cta-label': 'Вызвать замерщика' },
            actions: {
              cta: { href: '#lead-form', label: 'Вызвать замерщика' },
              phone: { href: 'tel:+79000000001', label: undefined },
            },
            data: {},
            groups: {},
          },
          {
            id: 'confirmation',
            role: 'confirmation',
            block: 'thank-you',
            variant: 'page',
            text: {
              title: 'Заявка на замер принята',
              'next-steps': 'Прораб позвонит и договорится о дне замера',
            },
            actions: {},
            data: {},
            groups: {},
          },
          {
            id: 'footer',
            role: 'footer',
            block: 'footer',
            variant: 'minimal',
            text: {
              legal: 'Студия ремонта «Отвес», Нижний Новгород',
              'privacy-label': 'Политика обработки персональных данных',
            },
            actions: { privacy: { href: '#lead-form', label: undefined } },
            data: { company: undefined },
            groups: {},
          },
        ],
      })
    })
  })
})
