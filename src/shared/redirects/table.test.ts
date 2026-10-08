import {
  buildRedirectTable,
  canonicalPath,
  isExternalTarget,
  redirectLocation,
  resolveRedirect,
} from './table'

describe('canonicalPath', () => {
  it('одна форма у адреса: без повторных и хвостового слеша, точек и index.html', () => {
    for (const [path, canonical] of [
      ['/', '/'],
      ['/blog', '/blog'],
      ['/blog/', '/blog'],
      ['//blog', '/blog'],
      ['/blog//zapis', '/blog/zapis'],
      ['/./blog', '/blog'],
      ['/blog/../about', '/about'],
      ['/blog/../../..', '/'],
      ['/index.html', '/'],
      ['/about/index.html', '/about'],
      ['/about/index.html/', '/about'],
      ['/blog/page/2', '/blog/page/2'],
      ['/_astro/site.B1x_2.css', '/_astro/site.B1x_2.css'],
      ['/.well-known/security.txt', '/.well-known/security.txt'],
      ['/500.html', '/500.html'],
    ] as const) {
      expect(canonicalPath(path), path).toBe(canonical)
    }
  })

  it('проценты — в одной записи: UTF-8 прописными hex, буквальное — буквально; регистр букв не трогается', () => {
    const encoded = '/%D1%83%D1%81%D0%BB%D1%83%D0%B3%D0%B8'
    for (const [path, canonical] of [
      ['/услуги', encoded],
      ['/%d1%83%d1%81%d0%bb%d1%83%d0%b3%d0%b8', encoded],
      [encoded, encoded],
      ['/%62log', '/blog'],
      ['/a/%2e%2e/b', '/b'],
      ['/photo%402x.png', '/photo@2x.png'],
      ['/a%20b', '/a%20b'],
      ['/a b', '/a%20b'],
      ['/a%2Bb', '/a+b'],
      ['/a%3Fb%23c', '/a%3Fb%23c'],
      ['/100%25', '/100%25'],
      ['/Old-Page', '/Old-Page'],
      ['/BLOG', '/BLOG'],
    ] as const) {
      expect(canonicalPath(path), path).toBe(canonical)
    }
  })

  it('канонический вид устойчив: повторное приведение его не меняет', () => {
    for (const path of ['/услуги/', '//a/./b/../c/index.html', '/a%2Bb/%d0%b0', '/a%3Fb', '/']) {
      const canonical = canonicalPath(path) ?? ''
      expect(canonicalPath(canonical), path).toBe(canonical)
    }
  })

  it('спрятанный разделитель и битая кодировка — канонического вида нет', () => {
    for (const path of ['/blog%2Fzapis', '/blog%2fzapis', '/a%5Cb', '/a\\b', '/%E0%A4%A', '/%zz']) {
      expect(canonicalPath(path), path).toBeUndefined()
    }
  })
})

describe('buildRedirectTable', () => {
  it('строит таблицу из валидных правил', () => {
    const table = buildRedirectTable([
      { from: '/old', to: '/blog', status: 301, note: 'демо' },
      { from: '/moved', to: 'https://example.com/x', status: 308 },
      { from: '/gone', status: 410 },
    ])
    expect(table.rules).toHaveLength(3)
    expect(table.find('/old')).toEqual({
      from: '/old',
      path: '/old',
      query: [],
      to: '/blog',
      status: 301,
      note: 'демо',
    })
    expect(table.find('/gone')).toEqual({ from: '/gone', path: '/gone', query: [], status: 410 })
    expect(table.find('/net-takogo')).toBeUndefined()
  })

  it('пустой файл (null/undefined после парсинга) — пустая таблица, не ошибка', () => {
    expect(buildRedirectTable(undefined).rules).toEqual([])
    expect(buildRedirectTable(null).rules).toEqual([])
    expect(buildRedirectTable([]).rules).toEqual([])
    expect(() => buildRedirectTable({ from: '/a', status: 410 })).toThrow()
  })

  // Адреса старого сайта — как они были: правило находится по каноническому пути.
  it('from миграции: заглавные, кириллица, проценты, хвостовой слеш, index.html и расширение', () => {
    const table = buildRedirectTable([
      { from: '/Old-Page', to: '/a', status: 301 },
      { from: '/услуги/', to: '/b', status: 301 },
      { from: '/%D0%BE-%D0%BD%D0%B0%D1%81', to: '/c', status: 301 },
      { from: '/page12345.html', to: '/d', status: 301 },
      { from: '/catalog/index.html', to: '/e', status: 301 },
    ])
    const target = (path: string) => {
      const rule = table.find(canonicalPath(path) ?? '')
      return rule && 'to' in rule ? rule.to : undefined
    }
    expect(target('/Old-Page')).toBe('/a')
    // Регистр — часть адреса: строчная форма — другой адрес.
    expect(target('/old-page')).toBeUndefined()
    expect(target('/услуги')).toBe('/b')
    expect(target('/%D1%83%D1%81%D0%BB%D1%83%D0%B3%D0%B8/')).toBe('/b')
    expect(target('/%d1%83%d1%81%d0%bb%d1%83%d0%b3%d0%b8')).toBe('/b')
    expect(target('/о-нас')).toBe('/c')
    expect(target('/page12345.html')).toBe('/d')
    expect(target('/catalog/')).toBe('/e')
    expect(target('/catalog')).toBe('/e')
  })

  it('from с ?query срабатывает, только когда в запросе есть все его пары; из подходящих — самое точное', () => {
    const table = buildRedirectTable([
      { from: '/index.php', to: '/home', status: 301 },
      { from: '/index.php?id=5', to: '/five', status: 301 },
      { from: '/index.php?id=5&lang=en', to: '/five-en', status: 301 },
      { from: '/?p=123', to: '/post', status: 301 },
    ])
    const target = (path: string, search: string) => {
      const rule = table.find(path, search)
      return rule && 'to' in rule ? rule.to : undefined
    }
    expect(target('/index.php', '?id=5')).toBe('/five')
    expect(target('/index.php', '?utm_source=x&id=5')).toBe('/five')
    expect(target('/index.php', '?lang=en&id=5')).toBe('/five-en')
    expect(target('/index.php', '?id=6')).toBe('/home')
    expect(target('/index.php', '')).toBe('/home')
    expect(target('/', '?p=123')).toBe('/post')
    // Правило с query на голый путь и на чужое значение не срабатывает.
    expect(target('/', '')).toBeUndefined()
    expect(target('/', '?p=124')).toBeUndefined()
    expect(target('/', '?page=123')).toBeUndefined()
  })

  it('отвергает дубли, петли и цепочки', () => {
    expect(() =>
      buildRedirectTable([
        { from: '/a', to: '/b', status: 301 },
        { from: '/a', to: '/c', status: 301 },
      ]),
    ).toThrow(/дубль/)
    // Одна и та же страница старого сайта, записанная двумя формами, — тот же адрес.
    expect(() =>
      buildRedirectTable([
        { from: '/a/', to: '/b', status: 301 },
        { from: '/a/index.html', to: '/c', status: 301 },
      ]),
    ).toThrow(/дубль from \/a\/index\.html/)
    expect(() =>
      buildRedirectTable([
        { from: '/a?x=1&y=2', to: '/b', status: 301 },
        { from: '/a?y=2&x=1', to: '/c', status: 301 },
      ]),
    ).toThrow(/дубль/)
    expect(() => buildRedirectTable([{ from: '/a', to: '/a', status: 301 }])).toThrow(/сам на себя/)
    expect(() => buildRedirectTable([{ from: '/a/', to: '/a', status: 301 }])).toThrow(
      /сам на себя/,
    )
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
    // Цель с правилом только на ?query — не цепочка: голый адрес цели оно не трогает.
    expect(
      buildRedirectTable([
        { from: '/a', to: '/b', status: 301 },
        { from: '/b?old=1', to: '/c', status: 301 },
        { from: '/d?x=1', to: '/d', status: 301 },
      ]).rules,
    ).toHaveLength(3)
  })

  it('отвергает статусы вне белого списка, 410 с целью и 301 без цели — с понятным текстом', () => {
    expect(() => buildRedirectTable([{ from: '/a', to: '/b', status: 302 }])).toThrow(/301|308|410/)
    expect(() => buildRedirectTable([{ from: '/a', to: '/b', status: 410 }])).toThrow(
      /у 410 цели нет/,
    )
    expect(() => buildRedirectTable([{ from: '/a', status: 301 }])).toThrow(/нужна цель/)
    expect(() => buildRedirectTable([{ from: '/a', status: 410, extra: 1 }])).toThrow(/extra/)
  })

  it('from — адрес от корня без пробелов, фрагмента и спрятанного разделителя; to — свой канонический путь или http(s) URL', () => {
    for (const from of ['a', 'https://x.example/a', '/a b', '/a#b', '/a%2Fb', '/a%5cb', '/%zz']) {
      expect(() => buildRedirectTable([{ from, status: 410 }]), from).toThrow()
    }
    for (const to of ['/A', '/a/', '/a?x=1', 'b', 'ftp://x.example']) {
      expect(() => buildRedirectTable([{ from: '/a', to, status: 301 }]), to).toThrow()
    }
  })

  it('различает внутренние и внешние цели', () => {
    expect(isExternalTarget('/blog')).toBe(false)
    expect(isExternalTarget('https://example.com/')).toBe(true)
  })
})

describe('redirectLocation', () => {
  const rule = (to: string, query: [string, string][] = []) => ({ to, query })

  it('без query — цель как есть', () => {
    expect(redirectLocation(rule('/blog'), '')).toBe('/blog')
    expect(redirectLocation(rule('https://example.com/x?k=v'), '')).toBe(
      'https://example.com/x?k=v',
    )
  })

  it('query запроса переезжает: к внутренней цели целиком, к внешней — после её собственной', () => {
    expect(redirectLocation(rule('/blog'), '?utm=1&x=a%20b')).toBe('/blog?utm=1&x=a%20b')
    expect(redirectLocation(rule('https://example.com/x'), '?utm=1')).toBe(
      'https://example.com/x?utm=1',
    )
    expect(redirectLocation(rule('https://example.com/x?k=v#top'), '?utm=1')).toBe(
      'https://example.com/x?k=v&utm=1#top',
    )
  })

  it('пары самого правила — адрес старой страницы: в Location не переезжают, остальные — как пришли', () => {
    const post = rule('/post', [['p', '123']])
    expect(redirectLocation(post, '?p=123')).toBe('/post')
    expect(redirectLocation(post, '?utm=1&p=123&x=a%20b')).toBe('/post?utm=1&x=a%20b')
    // Вторая пара с тем же ключом правилу не принадлежит.
    expect(redirectLocation(post, '?p=123&p=124')).toBe('/post?p=124')
    expect(redirectLocation(rule('https://example.com/x', [['id', '5']]), '?id=5&utm=1')).toBe(
      'https://example.com/x?utm=1',
    )
  })
})

describe('resolveRedirect', () => {
  const table = buildRedirectTable([
    { from: '/old', to: '/blog', status: 301 },
    { from: '/moved/', to: 'https://example.com/x', status: 308 },
    { from: '/?p=123', to: '/post', status: 301 },
    { from: '/Услуги/', to: '/contacts', status: 301 },
    { from: '/gone', status: 410 },
  ])
  const resolve = (url: string) => resolveRedirect(table, url)

  it('адрес таблицы в любой форме — один редирект сразу на цель, со статусом правила', () => {
    for (const url of ['/old', '/old/', '//old', '/old/index.html', '/./old', '/x/../old/']) {
      expect(resolve(url), url).toEqual({ status: 301, location: '/blog' })
    }
    expect(resolve('/old/?utm=1')).toEqual({ status: 301, location: '/blog?utm=1' })
    expect(resolve('/moved')).toEqual({ status: 308, location: 'https://example.com/x' })
    expect(resolve('/?p=123&utm=1')).toEqual({ status: 301, location: '/post?utm=1' })
    expect(resolve('/%D0%A3%D1%81%D0%BB%D1%83%D0%B3%D0%B8')).toEqual({
      status: 301,
      location: '/contacts',
    })
    expect(resolve('/%d0%a3%d1%81%d0%bb%d1%83%d0%b3%d0%b8/')).toEqual({
      status: 301,
      location: '/contacts',
    })
  })

  it('неканоническая форма без правила — один 301 на каноническую, query сохраняется', () => {
    expect(resolve('/blog/')).toEqual({ status: 301, location: '/blog' })
    expect(resolve('//blog')).toEqual({ status: 301, location: '/blog' })
    expect(resolve('/about/index.html?x=1')).toEqual({ status: 301, location: '/about?x=1' })
    expect(resolve('/index.html')).toEqual({ status: 301, location: '/' })
    expect(resolve('/blog/../about/')).toEqual({ status: 301, location: '/about' })
    expect(resolve('/%62log')).toEqual({ status: 301, location: '/blog' })
    // Чужой хост из двойного слеша в Location не попадает: это путь своего сайта.
    expect(resolve('//example.com/')).toEqual({ status: 301, location: '/example.com' })
  })

  it('каноническая форма без правила — адресу отвечает страница', () => {
    for (const url of ['/', '/blog', '/blog?x=1', '/blog?', '/?p=124', '/OLD', '/BLOG', '/a#b']) {
      expect(resolve(url), url).toBeUndefined()
    }
  })

  it('удалённый адрес — 410 в канонической форме, из другой формы — 301 на неё', () => {
    expect(resolve('/gone')).toEqual({ status: 410 })
    expect(resolve('/gone?x=1')).toEqual({ status: 410 })
    expect(resolve('/gone/')).toEqual({ status: 301, location: '/gone' })
  })

  it('спрятанный разделитель и битая кодировка — 404, а не редирект', () => {
    for (const url of ['/blog%2Fzapis', '/%2F%2Fexample.com/', '/a%5Cb', '/a\\b', '/%E0%A4%A']) {
      expect(resolve(url), url).toEqual({ status: 404 })
    }
  })

  it('цель запроса не от корня (absolute-form, `*`) — не адрес страницы', () => {
    expect(resolve('http://example.com/old')).toBeUndefined()
    expect(resolve('*')).toBeUndefined()
  })
})
