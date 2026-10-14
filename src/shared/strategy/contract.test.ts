import { chosenText, type DeckSlot, type Fact, langOf, targetAddress } from './contract'

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

  it('язык файла — первый подтег', () => {
    expect(langOf('ru')).toBe('ru')
    expect(langOf('en-GB')).toBe('en')
  })
})
