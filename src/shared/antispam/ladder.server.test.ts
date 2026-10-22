import { isTooLarge, isTrapped, isTrustedOrigin, readForm } from './ladder'

const SITE = 'https://demo.example'

// Прямое обращение к контейнеру: URL запроса — его собственный адрес, origin сайта — runtime SITE_URL.
const post = (headers: Record<string, string>, body: BodyInit = 'name=Мария') =>
  new Request('http://127.0.0.1:4321/api/contact', { method: 'POST', headers, body })

const form = (fields: Record<string, string>): FormData => {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.append(key, value)
  return data
}

beforeEach(() => {
  vi.stubEnv('SITE_URL', SITE)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('origin-check: свои — только origin сайта и origin самого запроса', () => {
  it.each([
    ['двойник с доменом сайта в начале', 'https://demo.example.attacker.tld'],
    ['поддомен', 'https://www.demo.example'],
    ['другой порт', 'https://demo.example:8443'],
    ['другая схема', 'http://demo.example'],
    ['домен сайта как userinfo', 'https://demo.example@attacker.tld'],
    ['непрозрачный origin', 'null'],
  ])('%s — чужой и в Origin, и в Referer', (_case, origin) => {
    expect(isTrustedOrigin(post({ origin }))).toBe(false)
    expect(isTrustedOrigin(post({ referer: `${origin}/contacts` }))).toBe(false)
  })

  it('Origin сайта, origin запроса и Referer со страницы сайта — свои', () => {
    expect(isTrustedOrigin(post({ origin: SITE }))).toBe(true)
    expect(isTrustedOrigin(post({ origin: 'http://127.0.0.1:4321' }))).toBe(true)
    expect(isTrustedOrigin(post({ referer: `${SITE}/en/contacts` }))).toBe(true)
  })

  // Ровно то, что видит контейнер за TLS-терминирующим прокси: URL запроса собран из Host по схеме http, а браузер
  // прислал https-origin сайта.
  it('за прокси: Origin совпал с SITE_URL, а URL запроса — чужой', () => {
    const request = new Request('http://demo.example/api/contact', {
      method: 'POST',
      headers: { origin: SITE },
    })
    expect(isTrustedOrigin(request)).toBe(true)
  })

  it('Origin важнее Referer: чужой Origin со своим Referer — чужой', () => {
    expect(
      isTrustedOrigin(post({ origin: 'https://attacker.tld', referer: `${SITE}/contacts` })),
    ).toBe(false)
  })

  it('ни Origin, ни Referer — чужой: браузер шлёт Origin на POST формы всегда', () => {
    expect(isTrustedOrigin(post({}))).toBe(false)
    expect(isTrustedOrigin(post({ origin: '' }))).toBe(false)
  })
})

describe('размер тела', () => {
  // Граница — литералом: 64 КБ.
  it('заявленная длина до 65 536 байт включительно — в лимите, байт сверх — отказ', () => {
    expect(isTooLarge(post({ 'content-length': '65536' }))).toBe(false)
    expect(isTooLarge(post({ 'content-length': '65537' }))).toBe(true)
  })

  it('длины нет или она не число — ступень тело не меряет', () => {
    expect(isTooLarge(new Request('http://127.0.0.1:4321/api/contact', { method: 'POST' }))).toBe(
      false,
    )
    expect(isTooLarge(post({ 'content-length': 'lots' }))).toBe(false)
  })
})

describe('форма тела', () => {
  it('urlencoded и multipart — форма', async () => {
    const urlencoded = await readForm(
      post({ 'content-type': 'application/x-www-form-urlencoded' }, 'name=Мария'),
    )
    expect(urlencoded?.get('name')).toBe('Мария')
    const multipart = await readForm(
      new Request('http://127.0.0.1:4321/api/contact', {
        method: 'POST',
        body: form({ name: 'Мария' }),
      }),
    )
    expect(multipart?.get('name')).toBe('Мария')
  })

  it('не форма, тело без типа и битое тело — не форма, без исключения', async () => {
    expect(
      await readForm(post({ 'content-type': 'application/json' }, '{"name":"бот"}')),
    ).toBeUndefined()
    expect(
      await readForm(post({ 'content-type': 'multipart/form-data' }, 'без границы')),
    ).toBeUndefined()
    // Тело байтами без Content-Type: тип формы не назван — не форма.
    const untyped = post({}, new TextEncoder().encode('name=бот'))
    expect(untyped.headers.get('content-type')).toBeNull()
    expect(await readForm(untyped)).toBeUndefined()
  })
})

describe('ловушка', () => {
  it('заполненное поле-ловушка — бот, пустое или без поля — человек', () => {
    expect(isTrapped(form({ trap: 'ООО Спам' }), 'trap')).toBe(true)
    expect(isTrapped(form({ trap: '' }), 'trap')).toBe(false)
    expect(isTrapped(form({ name: 'Мария' }), 'trap')).toBe(false)
  })
})
