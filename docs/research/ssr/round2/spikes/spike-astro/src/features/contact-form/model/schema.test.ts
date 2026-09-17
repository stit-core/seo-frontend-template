import { describe, expect, it } from 'vitest'
import { ContactInputSchema, formToObject, handleContact, MIN_FILL_MS } from './schema'

describe('contact form', () => {
  it('режет невалидный email', () => {
    const result = ContactInputSchema.safeParse({
      name: 'Иван',
      email: 'нет',
      message: 'x'.repeat(10),
    })
    expect(result.success).toBe(false)
  })

  it('honeypot не доходит до обработки', () => {
    expect(
      handleContact({ name: 'Bot', email: 'b@b.io', message: 'x'.repeat(10), company: 'spam' })
        .reason,
    ).toBe('honeypot')
  })

  it('time-trap режет отправку быстрее порога', () => {
    const now = 1_000_000
    expect(
      handleContact({ name: 'Bot', email: 'b@b.io', message: 'x'.repeat(10), ts: now - 100 }, now)
        .reason,
    ).toBe('time-trap')
    expect(
      handleContact(
        { name: 'Человек', email: 'b@b.io', message: 'x'.repeat(10), ts: now - MIN_FILL_MS - 1 },
        now,
      ).reason,
    ).toBeUndefined()
  })

  it('пустые строки FormData не ломают optional-поля', () => {
    const form = new FormData()
    form.set('name', 'Иван')
    form.set('email', 'i@e.io')
    form.set('message', 'x'.repeat(10))
    form.set('company', '')
    expect(ContactInputSchema.safeParse(formToObject(form)).success).toBe(true)
  })
})
