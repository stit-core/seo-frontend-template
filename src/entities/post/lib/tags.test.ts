import { isTagIndexable } from './tags'

describe('entities/post/lib/tags', () => {
  // Граница — литералами: порог в модуле и порог политики сборки расходятся только красным гейтом.
  it('тег индексируется от трёх записей, ниже — тонкая страница', () => {
    expect(isTagIndexable(3)).toBe(true)
    expect(isTagIndexable(12)).toBe(true)
    expect(isTagIndexable(2)).toBe(false)
    expect(isTagIndexable(0)).toBe(false)
  })
})
