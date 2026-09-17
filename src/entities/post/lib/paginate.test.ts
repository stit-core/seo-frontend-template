import { pageCount, paginate } from './paginate'

describe('paginate', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g']

  it('режет по 5, последняя страница короче', () => {
    expect(paginate(items, 1)).toEqual({
      items: ['a', 'b', 'c', 'd', 'e'],
      current: 1,
      last: 2,
      total: 7,
    })
    expect(paginate(items, 2)).toEqual({ items: ['f', 'g'], current: 2, last: 2, total: 7 })
  })

  it('пустой список — одна пустая первая страница', () => {
    expect(pageCount(0)).toBe(1)
    expect(paginate([], 1)).toEqual({ items: [], current: 1, last: 1, total: 0 })
  })

  it('ровно 5 и ровно 10 записей — без пустой последней страницы', () => {
    const five = Array.from({ length: 5 }, (_, index) => index)
    const ten = Array.from({ length: 10 }, (_, index) => index)
    expect(pageCount(5)).toBe(1)
    expect(() => paginate(five, 2)).toThrow()
    expect(pageCount(10)).toBe(2)
    expect(paginate(ten, 2).items).toHaveLength(5)
    expect(() => paginate(ten, 3)).toThrow()
  })

  it('страницы вне диапазона не существуют', () => {
    expect(() => paginate(items, 0)).toThrow()
    expect(() => paginate(items, 3)).toThrow()
    expect(() => paginate(items, 1.5)).toThrow()
  })

  it('размер страницы настраивается', () => {
    expect(pageCount(7, 3)).toBe(3)
    expect(paginate(items, 3, 3).items).toEqual(['g'])
  })
})
