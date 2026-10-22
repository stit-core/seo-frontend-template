import { CALLBACK_FORM as CALLBACK, LEAD_FORM as FORM } from '@/shared/lib/testing'
import { faultsOf, submissionOf } from './schema'

const data = (fields: Record<string, string>): FormData => {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  return form
}
const valid = {
  values: {
    name: 'Мария',
    email: 'maria@example.com',
    phone: '',
    'contact-channel': 'email',
    task: 'Нужен сайт.',
  },
  consent: true,
}

describe('форма: ответ человека', () => {
  it('поля набора как пришли — без пробелов по краям; ловушка и скрытые поля в ответ не входят', () => {
    expect(
      submissionOf(
        FORM,
        data({
          name: '  Мария ',
          task: 'Сайт',
          'company-website': 'бот',
          form_id: 'x',
          consent: '1',
        }),
      ),
    ).toEqual({
      values: { name: 'Мария', email: '', phone: '', 'contact-channel': '', task: 'Сайт' },
      consent: true,
    })
  })

  // Браузер шлёт значение чекбокса, только если он отмечен: пустое значение из рукописного запроса — не согласие.
  it('согласие — непустое значение галочки, а не наличие поля', () => {
    expect(submissionOf(FORM, data({ consent: '' })).consent).toBe(false)
    expect(submissionOf(FORM, data({})).consent).toBe(false)
  })
})

describe('форма: правила набора на сервере', () => {
  it('заполненная заявка — без отказов', () => {
    expect(faultsOf(FORM, valid)).toEqual({})
  })

  it('обязательное поле набора пустым — отказ: задача у contact-message, телефон у callback', () => {
    expect(faultsOf(FORM, { ...valid, values: { ...valid.values, task: '' } })).toEqual({
      task: 'required',
    })
    expect(faultsOf(CALLBACK, { values: { phone: '', name: 'Мария' }, consent: true })).toEqual({
      phone: 'required',
    })
  })

  it('«хотя бы одно из» — почта или телефон: пусто оба — отказ у каждого поля группы', () => {
    expect(faultsOf(FORM, { ...valid, values: { ...valid.values, email: '' } })).toEqual({
      email: 'oneOf',
      phone: 'oneOf',
    })
    expect(
      faultsOf(FORM, {
        ...valid,
        values: { ...valid.values, email: '', phone: '8 (495) 000-00-00' },
      }),
    ).toEqual({})
  })

  it.each([
    ['email', 'not-an-email', 'email'],
    ['phone', '12', 'tel'],
    ['phone', '+7 495 000 00 00 00 00 0', 'tel'],
    ['phone', 'позвоните', 'tel'],
    ['contact-channel', 'pigeon', 'option'],
  ])('вид значения: %s «%s» — %s', (field, value, fault) => {
    expect(faultsOf(FORM, { ...valid, values: { ...valid.values, [field]: value } })[field]).toBe(
      fault,
    )
  })

  // Границы — литералами: строка — 200 знаков, текст — 2000.
  it.each([
    ['name', 200, undefined],
    ['name', 201, 'long'],
    ['task', 2000, undefined],
    ['task', 2001, 'long'],
  ])('длина: %s в %i знаков — %s', (field, length, fault) => {
    expect(
      faultsOf(FORM, { ...valid, values: { ...valid.values, [field]: 'ж'.repeat(length) } })[field],
    ).toBe(fault)
  })

  it('поля, которых нет в ответе, — пустые', () => {
    expect(faultsOf(FORM, { values: {}, consent: true })).toEqual({
      email: 'oneOf',
      phone: 'oneOf',
      task: 'required',
    })
  })

  it('без согласия — отказ: галочка проверяется и на сервере', () => {
    expect(faultsOf(FORM, { ...valid, consent: false })).toEqual({ consent: 'consent' })
  })
})
