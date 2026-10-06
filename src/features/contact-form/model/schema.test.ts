import { EMPTY_CONTACT_VALUES, HONEYPOT_FIELD, toContactValues, validateContact } from './schema'

const valid = {
  name: 'Мария',
  email: 'maria@example.com',
  message: 'Нужен сайт с блогом и формой заявки. Бюджет обсудим.',
  consent: true,
}

const form = (fields: Record<string, string>): FormData => {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.append(key, value)
  return data
}

describe('contact form: значения', () => {
  it('читает поля формы, обрезает пробелы и понимает невыставленный чекбокс', () => {
    expect(
      toContactValues(
        form({
          name: '  Мария  ',
          email: 'maria@example.com ',
          message: 'Здравствуйте, нужен сайт.',
        }),
      ),
    ).toEqual({
      name: 'Мария',
      email: 'maria@example.com',
      message: 'Здравствуйте, нужен сайт.',
      consent: false,
    })
    expect(toContactValues(form({ consent: '1' })).consent).toBe(true)
    // Лишние поля (ловушка, локаль) в значения не попадают.
    expect(toContactValues(form({ [HONEYPOT_FIELD]: 'bot', locale: 'en' }))).toEqual(
      EMPTY_CONTACT_VALUES,
    )
  })
})

describe('contact form: валидация', () => {
  it('пропускает заполненную заявку', () => {
    const result = validateContact(valid)
    expect(result).toEqual({ ok: true, data: valid })
  })

  it('без согласия — отказ: галочка проверяется и на сервере', () => {
    const result = validateContact({ ...valid, consent: false })
    expect(result).toEqual({ ok: false, errors: { consent: 'form.error.consent' } })
  })

  it('каждое нарушенное поле получает своё сообщение', () => {
    const result = validateContact({
      name: 'М',
      email: 'not-an-email',
      message: 'коротко',
      consent: false,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toEqual({
      name: 'form.error.name',
      email: 'form.error.email',
      message: 'form.error.message',
      consent: 'form.error.consent',
    })
  })

  // Границы — литералами: имя 2–80 знаков, сообщение 10–2000.
  it.each([
    ['name', 1, false],
    ['name', 2, true],
    ['name', 80, true],
    ['name', 81, false],
    ['message', 9, false],
    ['message', 10, true],
    ['message', 2000, true],
    ['message', 2001, false],
  ])('бюджет поля: %s в %i знаков — %s', (field, length, ok) => {
    expect(validateContact({ ...valid, [field]: 'ж'.repeat(length) }).ok).toBe(ok)
  })
})
