import { invariant } from './invariant'

describe('invariant', () => {
  it('пропускает truthy-условие', () => {
    expect(() => invariant(1, 'не должно бросить')).not.toThrow()
  })

  it('бросает с сообщением на falsy-условии', () => {
    expect(() => invariant(false, 'что-то сломалось')).toThrowError(
      'Invariant violation: что-то сломалось',
    )
  })

  it('сужает тип (asserts) — после вызова значение non-null', () => {
    const maybe = (): string | null => 'ok'
    const value = maybe()
    invariant(value, 'value обязан быть строкой')
    // Компилируется без optional chaining — тип сужен до string.
    expect(value.length).toBe(2)
  })
})
