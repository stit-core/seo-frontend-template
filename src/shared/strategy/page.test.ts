import { PACKAGE_LANDING, testLocale } from '@/shared/lib/testing'
import { projectOf } from './contract'
import { languagesOf, linkOf, localesOf, readPage, siteOf, versionsOf } from './page'

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
    page: { id: 'repair', page_type: 'service-page' },
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
        variant: 'numbered',
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
          text: [{ id: 'privacy-label' }, { id: 'consent-label', anatomy: 'privacy-label' }],
          action: [
            { id: 'privacy', target: { kind: 'route', value: '/privacy' } },
            { id: 'consent', anatomy: 'privacy', target: { kind: 'route', value: '/soglasie' } },
          ],
          data: [
            { id: 'company', anatomy: 'company', fact: 'fact:studio', binds: ['privacy-label'] },
            { id: 'requisites', anatomy: 'requisites', fact: 'missing:legal-details' },
            { id: 'owner', fact: 'fact:studio' },
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
            {
              section_id: 'footer',
              slots: [
                { slot_id: 'privacy-label', variants: [{ id: 'a', text: 'Политика ПДн' }] },
                {
                  slot_id: 'consent-label',
                  variants: [{ id: 'a', text: 'Согласие на обработку' }],
                },
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
            {
              section_id: 'footer',
              slots: [
                { slot_id: 'privacy-label', variants: [{ id: 'a', text: 'Privacy policy' }] },
                { slot_id: 'consent-label', variants: [{ id: 'a', text: 'Consent' }] },
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
  it('секции плана по порядку: блок, вариант, слоты по элементам анатомии, группы', () => {
    const page = read(site())
    expect(page.sections.map(({ id, block, variant }) => [id, block, variant])).toEqual([
      ['hero', 'hero-text', 'statement-cta'],
      ['steps', 'steps', 'numbered'],
      ['footer', 'footer', 'minimal'],
    ])
    // Действие — адрес цели: подпись — свой текстовый элемент; без цели в плане адреса нет.
    expect(page.sections[0]).toStrictEqual({
      id: 'hero',
      role: 'hero',
      block: 'hero-text',
      variant: 'statement-cta',
      slots: {
        headline: 'Ремонт под ключ',
        'cta-label': 'Вызвать замерщика',
        cta: { href: '/kontakty' },
        chat: { href: 'https://max.ru/demo' },
        'lang-switch': { href: undefined },
      },
      groups: {},
    })
    // Экземпляр группы — по порядку плана, элементы — по анатомии; элемент без анатомии — по id слота.
    expect(page.sections[1]?.groups).toStrictEqual({
      step: [
        { title: 'Замер', body: 'Приедем в удобный день.' },
        {
          title: 'Смета',
          'step-2-body': 'Посчитаем за три дня.',
          phone: {
            id: 'phone',
            text: '+7 900 000-00-01',
            machine: { type: 'telephone', value: '+79000000001' },
            binds: [],
          },
        },
      ],
    })
    // Элемент, который план заполняет не раз, — список по порядку плана. Факт без machine для кода — текст, пробел
    // missing: — без значения, слот данных без анатомии элемент не заполняет.
    expect(page.sections[2]?.slots).toStrictEqual({
      'privacy-label': ['Политика ПДн', 'Согласие на обработку'],
      privacy: [{ href: '/privacy' }, { href: '/soglasie' }],
      company: {
        id: 'studio',
        text: 'Студия «Демо»',
        machine: undefined,
        binds: ['privacy-label'],
      },
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
      },
    })
    expect(page.sections[0]?.slots).toMatchObject({
      'cta-label': 'Book a survey',
      cta: { href: '/en/kontakty' },
    })
    expect(page.sections[2]?.slots).toMatchObject({
      'privacy-label': ['Privacy policy', 'Consent'],
      privacy: [{ href: '/en/privacy' }, { href: '/en/soglasie' }],
      company: { text: 'Demo studio' },
    })
    expect(read(site()).meta).toEqual({
      title: 'Ремонт под ключ — Студия «Демо»',
      description: 'Ремонт квартир под ключ.',
      ogTitle: undefined,
      ogDescription: undefined,
    })
  })

  // Маршрут цели — страница карты на языке страницы; без её версии на нём — версия на другом языке (ссылка на страницу
  // карты), ссылка называет его; версий нет вовсе — ошибка.
  it('маршрут действия — страница карты: своя версия, без неё — версия другого языка с его кодом', () => {
    const toServices = (versions: string[]) =>
      edited((files) => {
        const [hero] = files['site/web/plans/repair.yaml'].sections
        const [cta] = hero && 'action' in hero.slots ? hero.slots.action : []
        if (cta) Object.assign(cta, { target: { kind: 'route', value: '/uslugi' } })
        for (const page of files['site/web/site-map.yaml'].pages) {
          if (page.id === 'services') Object.assign(page, { lang_versions: versions })
        }
      })
    expect(read(toServices(['ru', 'en']), 'en').sections[0]?.slots.cta).toStrictEqual({
      href: '/en/uslugi',
    })
    expect(read(toServices(['ru']), 'en').sections[0]?.slots.cta).toStrictEqual({
      href: '/uslugi',
      hreflang: 'ru',
    })
    expect(() => read(toServices(['fr']), 'en')).toThrow(
      'strategy: repair/hero/cta — /uslugi: у страницы карты нет ни одной версии',
    )
  })

  // Правовое плана: политика ПДн — ссылка на её версию по карте, как цель действия; оператор — факт языка страницы.
  it('политика ПДн и оператор — из legal плана: ссылка по карте и факт языка страницы', () => {
    const withLegal = (operator: string) =>
      edited((files) => {
        Object.assign(files['site/web/plans/repair.yaml'].page, {
          legal: { privacy_policy: '/uslugi', operator_ref: operator },
        })
        for (const page of files['site/web/site-map.yaml'].pages) {
          if (page.id === 'services') Object.assign(page, { lang_versions: ['ru'] })
        }
      })
    expect(read(withLegal('fact:studio'), 'en')).toMatchObject({
      policy: { href: '/uslugi', hreflang: 'ru' },
      operator: { id: 'studio', text: 'Demo studio', machine: undefined, binds: [] },
    })
    expect(read(withLegal('missing:legal-details'))).toMatchObject({
      policy: { href: '/uslugi' },
      operator: undefined,
    })
    expect(read(site())).toMatchObject({ policy: undefined, operator: undefined })
    expect(() => read(withLegal('fact:owner'))).toThrow(
      'strategy: repair/legal/operator_ref — fact:owner нет в фактах ru',
    )
  })

  // Факты, которые называет страница, — источник свойств её организации (head-kit `fields_from_facts`): ссылки `fact:`
  // плана и `fact_ids` её текстов copy deck, в порядке файла фактов языка; типы её JSON-LD — `seo.structured_data` плана.
  it('факты страницы — `fact:` плана и `fact_ids` её текстов, в порядке файла фактов; типы JSON-LD — план', () => {
    const named = edited((files) => {
      Object.assign(files['site/web/plans/repair.yaml'].page, {
        seo: { structured_data: ['Service', 'BreadcrumbList'] },
      })
      const [page] = files['site/web/copy/repair.yaml'].copy_deck.pages
      Object.assign(page?.meta ?? {}, { fact_ids: ['fact:chat', 'missing:price'] })
    })
    const page = read(named)
    expect(page.structuredData).toEqual(['Service', 'BreadcrumbList'])
    expect(page.facts).toStrictEqual([
      {
        id: 'phone',
        text: '+7 900 000-00-01',
        machine: { type: 'telephone', value: '+79000000001' },
        binds: [],
      },
      {
        id: 'chat',
        text: 'Написать в MAX',
        machine: { type: 'messenger', network: 'max', value: 'https://max.ru/demo' },
        binds: [],
      },
      { id: 'studio', text: 'Студия «Демо»', machine: undefined, binds: [] },
    ])
    // У другого языка — свой copy deck: его тексты называют свои факты.
    expect(read(named, 'en').facts.map(({ text }) => text)).toEqual([
      '+7 900 000-00-01',
      'Demo studio',
    ])
    expect(read(site())).toMatchObject({ structuredData: [] })
    const unknown = edited((files) => {
      const [page] = files['site/web/copy/repair.yaml'].copy_deck.pages
      const [hero] = page?.sections ?? []
      Object.assign(hero?.slots[0] ?? {}, { fact_ids: ['fact:owner'] })
    })
    expect(() => read(unknown)).toThrow(
      'strategy: repair/hero/headline — fact:owner нет в фактах ru',
    )
  })

  it('без карты (лендинг) — адрес из page.url плана, родителей нет', () => {
    const files = edited((files) => {
      Reflect.deleteProperty(files, 'site/web/site-map.yaml')
      Object.assign(files['site/web/plans/repair.yaml'].page, { url: '/remont' })
    })
    expect(read(files)).toMatchObject({ url: '/remont', parents: [] })
  })

  // Шаблон коллекции — страница записи: тексты шаблона — copy deck, слот без текста, медиа-слот и мету страницы даёт
  // запись.
  it('шаблон коллекции: слот без текста в copy deck и медиа-слот — слоты записи, меты нет; тексты шаблона — как у страницы', () => {
    const files = edited((files) => {
      Object.assign(files['site/web/plans/repair.yaml'].page, { template: true })
      Object.assign(files['site/web/plans/repair.yaml'].sections[0]?.slots ?? {}, {
        media: [{ id: 'cover' }],
      })
      for (const page of files['site/web/copy/repair.yaml'].copy_deck.pages) {
        page.sections.at(0)?.slots.shift()
        page.sections.at(1)?.slots.pop()
        Reflect.deleteProperty(page, 'meta')
      }
    })
    const page = read(files)
    expect(page.meta).toBeUndefined()
    expect(page.sections[0]?.slots).toStrictEqual({
      'cta-label': 'Вызвать замерщика',
      cta: { href: '/kontakty' },
      chat: { href: 'https://max.ru/demo' },
      'lang-switch': { href: undefined },
    })
    expect(page.sections.map((section) => section.blank)).toEqual([['headline', 'cover'], [], []])
    // Текст экземпляра набора без copy deck — не слот записи: экземпляр план даёт целиком, его неполноту судит схема блока.
    expect(page.sections[1]?.groups.step?.[1]).toStrictEqual({
      title: 'Смета',
      phone: read(site()).sections[1]?.groups.step?.[1]?.phone,
    })
    expect(page.sections.slice(2).map(({ blank: _blank, ...section }) => section)).toStrictEqual(
      read(site()).sections.slice(2),
    )
    // У плана одной страницы слотов записи нет: медиа-слот запись не заполняет.
    expect(read(site()).sections.map((section) => 'blank' in section)).toEqual([
      false,
      false,
      false,
    ])
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

    it('ссылка на страницу карты: её версия на языке страницы, без неё — основного языка, без неё — любая', () => {
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
      expect(linkOf(projectOf(withoutPrimary), '/uslugi', testLocale('de'))).toEqual({
        href: '/en/uslugi',
        hreflang: 'en',
      })
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

  describe('каркас по карте', () => {
    const menu = (labels: string[], code: 'ru' | 'de' = 'ru') =>
      siteOf(
        projectOf(
          edited((files) => {
            Object.assign(files['site/web/site-map.yaml'], {
              chrome: { header: { items: [{ page: 'services' }, { page: 'repair' }] } },
            })
          }),
        ),
      ).menuLinks(labels, testLocale(code), 'repair/header/nav-link')

    it('меню шапки — страницы chrome.header.items по порядку с подписями плана; меню версии — её разделы', () => {
      expect(menu(['Услуги', 'Ремонт'])).toEqual([
        { href: '/uslugi', label: 'Услуги' },
        { href: '/uslugi/remont', label: 'Ремонт' },
      ])
      // У «услуг» нет немецкой версии: в немецком меню их нет.
      expect(menu(['Dienste', 'Renovierung'], 'de')).toEqual([
        { href: '/de/uslugi/remont', label: 'Renovierung' },
      ])
      expect(siteOf(projectOf(site())).menuLinks([], testLocale('ru'), 'repair/header')).toEqual([])
    })

    it('подписей меню меньше или больше пунктов карты — ошибка называет ключ', () => {
      for (const labels of [['Услуги'], ['Услуги', 'Ремонт', 'Ещё']]) {
        expect(() => menu(labels)).toThrow(
          `strategy: repair/header/nav-link — подписей меню ${labels.length}, а пунктов chrome.header.items карты 2`,
        )
      }
    })

    it('крошки — у шаблона карты с крошками и с глубины 2', () => {
      const crumbs = siteOf(
        projectOf(
          edited((files) => {
            const map = files['site/web/site-map.yaml']
            Object.assign(map, { templates: [{ id: 'service', breadcrumbs: true }] })
            for (const page of map.pages) Object.assign(page, { template: 'service' })
          }),
        ),
      ).breadcrumbsOn
      expect(['home', 'services', 'repair'].filter(crumbs)).toEqual(['repair'])
      expect(siteOf(projectOf(site())).breadcrumbsOn('repair')).toBe(false)
    })
  })

  describe('фикстура базы package-landing', () => {
    it('страница читается без правки кода: секции, тексты выбранных вариантов, действия, мета', () => {
      expect(readPage(projectOf(PACKAGE_LANDING), 'spasibo', testLocale('ru'))).toStrictEqual({
        id: 'spasibo',
        url: '/spasibo',
        parents: [],
        meta: {
          title: 'Заявка на замер принята — студия «Отвес»',
          description: 'Заявка на замер принята. Студия ремонта «Отвес», Нижний Новгород.',
          ogTitle: 'Заявка на замер принята',
          ogDescription: 'Прораб позвонит и договорится о дне замера.',
        },
        sections: [
          {
            id: 'header',
            role: 'header',
            block: 'header',
            variant: 'landing-minimal',
            slots: {
              'cta-label': 'Вызвать замерщика',
              cta: { href: '#lead-form' },
              phone: { href: 'tel:+79000000001' },
            },
            groups: {},
          },
          {
            id: 'confirmation',
            role: 'confirmation',
            block: 'thank-you',
            variant: 'page',
            slots: {
              title: 'Заявка на замер принята',
              'next-steps': 'Прораб позвонит и договорится о дне замера',
            },
            groups: {},
          },
          {
            id: 'footer',
            role: 'footer',
            block: 'footer',
            variant: 'minimal',
            slots: {
              legal: 'Студия ремонта «Отвес», Нижний Новгород',
              'privacy-label': 'Политика обработки персональных данных',
              privacy: { href: '#lead-form' },
              company: undefined,
            },
            groups: {},
          },
        ],
        h1: 'Заявка на замер принята',
        policy: { href: '/privacy' },
        operator: undefined,
        structuredData: [],
        facts: [],
      })
    })
  })
})
