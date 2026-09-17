import { buildRedirectTable } from '@/shared/redirects'
import redirects from '../../../content/redirects.yaml'
import { matchRedirect, redirectResponse } from './redirects'

describe('app/middleware/redirects', () => {
  it('каждое from из content/redirects.yaml находится по точному пути', () => {
    const table = buildRedirectTable(redirects)
    expect(table.size).toBeGreaterThan(0)
    for (const rule of table.values()) {
      expect(matchRedirect(rule.from)).toEqual(rule)
      // Слеш-вариант до middleware не доходит (Astro нормализует раньше), регистр не сводится.
      expect(matchRedirect(`${rule.from}/`)).toBeUndefined()
      expect(matchRedirect(rule.from.toUpperCase())).toBeUndefined()
    }
    expect(matchRedirect('/')).toBeUndefined()
    expect(matchRedirect('/net-takogo')).toBeUndefined()
  })

  it('301/308: Location — цель плюс query запроса', () => {
    const rule = { from: '/a', to: '/b', status: 301 } as const
    const plain = redirectResponse(rule)
    expect(plain.status).toBe(301)
    expect(plain.headers.get('location')).toBe('/b')
    expect(redirectResponse(rule, '?x=1&y=2').headers.get('location')).toBe('/b?x=1&y=2')
    const external = redirectResponse(
      { from: '/a', to: 'https://x.example/p?k=v', status: 308 },
      '?x=1',
    )
    expect(external.status).toBe(308)
    expect(external.headers.get('location')).toBe('https://x.example/p?k=v&x=1')
  })

  it('410: тело с заголовком и noindex, без Location', async () => {
    const response = redirectResponse({ from: '/gone', status: 410 }, '?x=1')
    expect(response.status).toBe(410)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('x-robots-tag')).toBe('noindex')
    expect(response.headers.get('content-type')).toContain('text/html')
    const html = await response.text()
    expect(html).toContain('<meta name="robots" content="noindex">')
    expect(html).toContain('Страница удалена')
  })
})
