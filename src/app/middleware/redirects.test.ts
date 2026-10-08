import { localePath, SUPPORTED_LOCALES, t } from '@/shared/i18n'
import { buildRedirectTable } from '@/shared/redirects'
import redirects from '../../../content/redirects.yaml'
import { goneResponse } from './gone'
import { resolveRequest } from './redirects'

describe('app/middleware/redirects', () => {
  const { rules } = buildRedirectTable(redirects)
  // Адрес правила, каким его пришлёт клиент: буквы вне ASCII — процентами, уже закодированное и
  // пары query — как в файле.
  const requestOf = (from: string) => from.replace(/[^ -~]+/g, encodeURIComponent)

  it('каждое from из content/redirects.yaml отвечает своим правилом — и в форме с хвостовым слешем', () => {
    expect(rules.length).toBeGreaterThan(0)
    for (const rule of rules) {
      const expected =
        'to' in rule ? { status: rule.status, location: rule.to } : { status: rule.status }
      expect(resolveRequest('GET', requestOf(rule.from)), rule.from).toEqual(expected)
      expect(resolveRequest('HEAD', requestOf(rule.from)), rule.from).toEqual(expected)
      // Переезд из неканонической формы — тем же одним хопом, без остановки на канонической.
      const slashed = `${rule.path}/${rule.from.includes('?') ? rule.from.slice(rule.from.indexOf('?')) : ''}`
      if ('to' in rule) expect(resolveRequest('GET', slashed), slashed).toEqual(expected)
    }
    expect(resolveRequest('GET', '/')).toBeUndefined()
    expect(resolveRequest('GET', '/net-takogo')).toBeUndefined()
  })

  it('адрес читает только чтение страницы: остальные методы идут в приложение как есть', () => {
    const [rule] = rules
    for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS', undefined]) {
      expect(resolveRequest(method, requestOf(rule?.from ?? '')), method).toBeUndefined()
      expect(resolveRequest(method, '/blog/'), method).toBeUndefined()
    }
  })

  it('410: тело с заголовком и noindex, без Location', async () => {
    const response = goneResponse('ru')
    expect(response.status).toBe(410)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('x-robots-tag')).toBe('noindex')
    expect(response.headers.get('content-type')).toContain('text/html')
    expect(await response.text()).toContain('<meta name="robots" content="noindex">')
  })

  it('410 — на языке удалённого адреса: lang, текст и ссылка на главную своей локали, без второго языка', async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const html = await goneResponse(locale).text()
      expect(html).toContain(`<html lang="${locale}">`)
      expect(html).toContain(`<h1>${t(locale, 'gone.title')}</h1>`)
      expect(html).toContain(t(locale, 'gone.lead'))
      expect(html).toContain(
        `<a href="${localePath(locale, '/')}">${t(locale, 'notFound.home')}</a>`,
      )
      for (const other of SUPPORTED_LOCALES.filter((candidate) => candidate !== locale)) {
        expect(html, other).not.toContain(t(other, 'gone.lead'))
        expect(html, other).not.toContain(t(other, 'gone.title'))
        expect(html, other).not.toContain(`lang="${other}"`)
      }
    }
  })
})
