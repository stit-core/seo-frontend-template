import { describe, expect, it } from 'vitest'
import { contactSchema } from './schema'

describe('contactSchema', () => {
  it('принимает валидные данные', () => {
    const r = contactSchema().safeParse({
      name: 'Иван',
      email: 'a@b.co',
      message: 'Достаточно длинное сообщение',
    })
    expect(r.success).toBe(true)
  })
  it('отвергает короткое имя и битый email', () => {
    expect(
      contactSchema().safeParse({ name: 'И', email: 'nope', message: 'x'.repeat(10) }).success,
    ).toBe(false)
  })
})
