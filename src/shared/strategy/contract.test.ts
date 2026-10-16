import {
  chosenText,
  type DeckSlot,
  type Fact,
  hasBreadcrumbs,
  langOf,
  mapLanguages,
  pageLanguages,
  parentsOf,
  relatedRule,
  SiteMapSchema,
  targetAddress,
  untranslatedFallback,
} from './contract'

const slot = (variants: DeckSlot['variants'], chosen?: string): DeckSlot => ({
  slot_id: 'headline',
  variants,
  chosen,
})

const facts = new Map<string, Fact>(
  (
    [
      {
        id: 'chat',
        verbatim: ['Написать в MAX'],
        machine: { type: 'messenger', network: 'max', value: 'https://max.ru/demo' },
      },
      {
        id: 'site',
        verbatim: ['demo.example'],
        machine: { type: 'url', value: 'https://demo.example' },
      },
      {
        id: 'phone',
        verbatim: ['+7 900 000-00-01'],
        machine: { type: 'telephone', value: '+79000000001' },
      },
      { id: 'studio', verbatim: ['Студия «Демо»'] },
    ] satisfies Fact[]
  ).map((fact): [string, Fact] => [fact.id, fact]),
)

describe('strategy/contract', () => {
  describe('текст слота', () => {
    it('выбранный вариант, а не первый', () => {
      const variants: DeckSlot['variants'] = [
        { id: 'a', text: 'Первый вариант' },
        { id: 'b', text: 'Выбранный вариант' },
      ]
      expect(chosenText(slot(variants, 'b'), 'home/hero/headline')).toBe('Выбранный вариант')
    })

    it('без chosen — единственный вариант', () => {
      expect(chosenText(slot([{ id: 'a', text: 'Единственный' }]), 'home/hero/headline')).toBe(
        'Единственный',
      )
    })

    it('без chosen при нескольких вариантах и с chosen без варианта — ошибка называет ключ', () => {
      const variants: DeckSlot['variants'] = [
        { id: 'a', text: 'Первый' },
        { id: 'b', text: 'Второй' },
      ]
      expect(() => chosenText(slot(variants), 'home/hero/headline')).toThrow(
        'strategy: home/hero/headline — вариантов 2, а chosen нет',
      )
      expect(() => chosenText(slot(variants, 'c'), 'home/hero/headline')).toThrow(
        'strategy: home/hero/headline — chosen «c» — такого варианта нет',
      )
    })
  })

  describe('адрес действия', () => {
    it('литерал цели — как есть', () => {
      for (const [kind, value] of [
        ['anchor', '#lead-form'],
        ['tel', 'tel:+79000000001'],
        ['url', 'mailto:hello@demo.example'],
        ['messenger', 'https://t.me/demo'],
        ['external', 'https://demo.example/price.pdf'],
      ] as const) {
        expect(targetAddress({ kind, value }, facts, 'home/hero/cta')).toBe(value)
      }
    })

    it('цель messenger:<fact-id> — адрес ссылки из machine факта', () => {
      expect(
        targetAddress({ kind: 'messenger', value: 'messenger:chat' }, facts, 'home/hero/cta'),
      ).toBe('https://max.ru/demo')
      expect(
        targetAddress({ kind: 'messenger', value: 'messenger:site' }, facts, 'home/hero/cta'),
      ).toBe('https://demo.example')
    })

    it('у факта цели нет адреса ссылки или факта нет — ошибка называет ключ: canonical код не разбирает', () => {
      for (const fact of ['studio', 'phone', 'nobody']) {
        expect(() =>
          targetAddress({ kind: 'messenger', value: `messenger:${fact}` }, facts, 'home/hero/cta'),
        ).toThrow(
          `strategy: home/hero/cta — messenger:${fact}: у факта нет machine с адресом ссылки`,
        )
      }
    })
  })

  it('язык файла — первый подтег BCP 47', () => {
    expect(langOf('ru')).toBe('ru')
    expect(langOf('en-GB')).toBe('en')
    expect(langOf('fil-PH')).toBe('fil')
  })

  describe('языки карты', () => {
    // Основной язык без своей строки версии, вторая версия — частичная, третья — со всеми страницами.
    const map = SiteMapSchema.parse({
      languages: {
        primary: 'ru-RU',
        versions: [
          { lang: 'en-GB', scope: 'selected-pages', pages: ['home', 'about'] },
          { lang: 'kk', scope: 'all-pages', untranslated_fallback: 'hide-link' },
        ],
      },
      pages: [
        { id: 'home', url: '/', parent: null },
        { id: 'about', url: '/about', parent: 'home' },
        { id: 'privacy', url: '/legal/privacy', parent: null, lang_versions: ['ru'] },
      ],
    })

    it('основной язык первым, затем версии по порядку карты; язык — первый подтег', () => {
      expect(mapLanguages(map)).toEqual(['ru', 'en', 'kk'])
    })

    it('страница — в версиях со всеми страницами и в тех, где она в списке; lang_versions сужает набор', () => {
      expect(pageLanguages(map, 'about')).toEqual(['ru', 'en', 'kk'])
      expect(pageLanguages(map, 'privacy')).toEqual(['ru'])
      expect(() => pageLanguages(map, 'blog')).toThrow('strategy: blog — страницы нет в карте')
    })

    it('переключатель без перевода — по untranslated_fallback версии, по умолчанию на главную языка', () => {
      expect(untranslatedFallback(map, 'en')).toBe('language-home')
      expect(untranslatedFallback(map, 'kk')).toBe('hide-link')
      expect(untranslatedFallback(map, 'ru')).toBe('language-home')
    })
  })

  describe('место в карте и крошки', () => {
    // Раздел с хабом под главной, страница под ним, документ без родителя и его вложенная страница; крошки — у шаблонов
    // page и doc.
    const map = SiteMapSchema.parse({
      languages: { primary: 'ru' },
      templates: [
        { id: 'hub', breadcrumbs: false },
        { id: 'page', breadcrumbs: true },
        { id: 'doc', breadcrumbs: true },
      ],
      pages: [
        { id: 'home', template: 'page', url: '/', parent: null },
        { id: 'services', template: 'hub', url: '/uslugi', parent: 'home' },
        { id: 'repair', template: 'page', url: '/uslugi/remont', parent: 'services' },
        { id: 'flat', template: 'page', url: '/uslugi/remont/kvartira', parent: 'repair' },
        { id: 'about', template: 'page', url: '/about', parent: 'home' },
        { id: 'policy', template: 'doc', url: '/policy', parent: null },
        { id: 'cookies', template: 'doc', url: '/policy/cookies', parent: 'policy' },
        { id: 'loose', url: '/loose', parent: 'home' },
      ],
    })

    it('родители — от корня к ближайшему; родителя нет в карте или цепочка замкнулась — ошибка с ключом', () => {
      expect(parentsOf(map, 'flat').map(({ id }) => id)).toEqual(['home', 'services', 'repair'])
      expect(parentsOf(map, 'home')).toEqual([])
      const broken = SiteMapSchema.parse({
        languages: { primary: 'ru' },
        pages: [
          { id: 'a', url: '/a', parent: 'b' },
          { id: 'b', url: '/b', parent: 'a' },
          { id: 'c', url: '/c', parent: 'nobody' },
        ],
      })
      expect(() => parentsOf(broken, 'a')).toThrow('strategy: a — родители в карте замкнулись на a')
      expect(() => parentsOf(broken, 'c')).toThrow('strategy: c — родителя nobody нет в карте')
    })

    // Глубина — от главной: у главной 0, у страницы без родителя — 1.
    it('крошки — у шаблона с крошками и только с глубины 2', () => {
      expect(
        ['home', 'services', 'repair', 'flat', 'about', 'policy', 'cookies', 'loose'].filter((id) =>
          hasBreadcrumbs(map, id),
        ),
      ).toEqual(['repair', 'flat', 'cookies'])
    })
  })

  // Связанные страницы шаблона — правило перелинковки карты: признак связи и сколько страниц показать.
  it('связанные — правило карты для шаблона страницы; нет правила у шаблона или в карте — ошибка с ключом', () => {
    const map = SiteMapSchema.parse({
      languages: { primary: 'ru' },
      templates: [
        { id: 'post', related: 'post-tags' },
        { id: 'case', related: 'case-services' },
        { id: 'hub' },
      ],
      pages: [
        { id: 'post', template: 'post', url: '/blog/{slug}', parent: null },
        { id: 'case', template: 'case', url: '/kejsy/{slug}', parent: null },
        { id: 'blog', template: 'hub', url: '/blog', parent: null },
      ],
      linking: { related_rules: [{ id: 'post-tags', by: 'shared-tag', max: 3 }] },
    })
    expect(relatedRule(map, 'post')).toEqual({ id: 'post-tags', by: 'shared-tag', max: 3 })
    for (const id of ['case', 'blog']) {
      expect(() => relatedRule(map, id)).toThrow(
        `strategy: ${id} — у шаблона нет правила связанных в linking.related_rules карты`,
      )
    }
  })
})
