import { cn } from './cn'

describe('cn', () => {
  it('склеивает классы через пробел', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c')
  })

  it('отбрасывает falsy-части', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })

  it('возвращает пустую строку без аргументов', () => {
    expect(cn()).toBe('')
  })
})
