import { buildRedirectTable, isExternalTarget, redirectLocation } from './table'

describe('buildRedirectTable', () => {
  it('строит таблицу из валидных правил', () => {
    const table = buildRedirectTable([
      { from: '/old', to: '/blog', status: 301, note: 'демо' },
      { from: '/moved', to: 'https://example.com/x', status: 308 },
      { from: '/gone', status: 410 },
    ])
    expect(table.size).toBe(3)
    expect(table.get('/old')).toEqual({ from: '/old', to: '/blog', status: 301, note: 'демо' })
    expect(table.get('/gone')).toEqual({ from: '/gone', status: 410 })
  })

  it('пустой файл (null/undefined после парсинга) — пустая таблица, не ошибка', () => {
    expect(buildRedirectTable(undefined).size).toBe(0)
    expect(buildRedirectTable(null).size).toBe(0)
    expect(buildRedirectTable([]).size).toBe(0)
    expect(() => buildRedirectTable({ from: '/a', status: 410 })).toThrow()
  })

  it('отвергает дубли, петли и цепочки', () => {
    expect(() =>
      buildRedirectTable([
        { from: '/a', to: '/b', status: 301 },
        { from: '/a', to: '/c', status: 301 },
      ]),
    ).toThrow(/дубль/)
    expect(() => buildRedirectTable([{ from: '/a', to: '/a', status: 301 }])).toThrow(/сам на себя/)
    expect(() =>
      buildRedirectTable([
        { from: '/a', to: '/b', status: 301 },
        { from: '/b', to: '/c', status: 301 },
        { from: '/b', status: 410 },
      ]),
    ).toThrow(/дубль from \/b.*цепочка \/a/s)
    expect(() =>
      buildRedirectTable([
        { from: '/a', to: '/b', status: 301 },
        { from: '/b', to: '/c', status: 301 },
      ]),
    ).toThrow(/цепочка/)
    expect(() =>
      buildRedirectTable([
        { from: '/a', to: '/b', status: 301 },
        { from: '/b', to: '/a', status: 308 },
      ]),
    ).toThrow(/цепочка/)
  })

  it('отвергает статусы вне белого списка, 410 с целью и 301 без цели — с понятным текстом', () => {
    expect(() => buildRedirectTable([{ from: '/a', to: '/b', status: 302 }])).toThrow(/301|308|410/)
    expect(() => buildRedirectTable([{ from: '/a', to: '/b', status: 410 }])).toThrow(
      /у 410 цели нет/,
    )
    expect(() => buildRedirectTable([{ from: '/a', status: 301 }])).toThrow(/нужна цель/)
    expect(() => buildRedirectTable([{ from: '/a', status: 410, extra: 1 }])).toThrow(/extra/)
  })

  it('отвергает пути с query, хвостовым слешем, заглавными и без ведущего слеша', () => {
    for (const from of ['/a?x=1', '/a/', '/A', 'a', 'https://x.example/a']) {
      expect(() => buildRedirectTable([{ from, status: 410 }]), from).toThrow()
    }
    expect(() => buildRedirectTable([{ from: '/a', to: 'ftp://x.example', status: 301 }])).toThrow()
  })

  it('различает внутренние и внешние цели', () => {
    expect(isExternalTarget('/blog')).toBe(false)
    expect(isExternalTarget('https://example.com/')).toBe(true)
  })
})

describe('redirectLocation', () => {
  it('без query — цель как есть', () => {
    expect(redirectLocation('/blog', '')).toBe('/blog')
    expect(redirectLocation('https://example.com/x?k=v', '')).toBe('https://example.com/x?k=v')
  })

  it('query запроса переезжает: к внутренней цели целиком, к внешней — после её собственной', () => {
    expect(redirectLocation('/blog', '?utm=1&x=a%20b')).toBe('/blog?utm=1&x=a%20b')
    expect(redirectLocation('https://example.com/x', '?utm=1')).toBe('https://example.com/x?utm=1')
    expect(redirectLocation('https://example.com/x?k=v#top', '?utm=1')).toBe(
      'https://example.com/x?k=v&utm=1#top',
    )
  })
})
