import {
  EMPTY_CONTACT_VALUES,
  HONEYPOT_FIELD,
  MESSAGE_LENGTH,
  NAME_LENGTH,
  toContactValues,
  validateContact,
} from './schema'

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

  it('держит бюджеты длины полей', () => {
    expect(validateContact({ ...valid, name: 'и'.repeat(NAME_LENGTH.max) }).ok).toBe(true)
    expect(validateContact({ ...valid, name: 'и'.repeat(NAME_LENGTH.max + 1) }).ok).toBe(false)
    expect(validateContact({ ...valid, message: 'т'.repeat(MESSAGE_LENGTH.max + 1) }).ok).toBe(
      false,
    )
    expect(validateContact({ ...valid, message: 'т'.repeat(MESSAGE_LENGTH.min - 1) }).ok).toBe(
      false,
    )
  })
})
