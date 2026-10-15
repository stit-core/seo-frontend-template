import { SITE_ORIGIN_PLACEHOLDER } from '@/shared/config'
import { absoluteUrl, alternates, normalizePath } from './urls'

// hreflang — на локалях теста (ru, en, de), а не на локалях сайта.
vi.mock('@/shared/i18n', async (importOriginal) =>
  (await import('@/shared/lib/testing')).withTestLocales(importOriginal),
)

// Карта переводов фикстуры: коды её локалей — не локали сайта, поэтому тип — строковый.
const versions = (map: Record<string, string>) => map

describe('seo/urls', () => {
  beforeEach(() => vi.stubEnv('SITE_URL', 'https://demo.example'))
  afterEach(() => vi.unstubAllEnvs())

  it('normalizePath: без query, фрагмента и хвостового слеша; регистр сохраняется', () => {
    expect(normalizePath('/')).toBe('/')
    expect(normalizePath('')).toBe('/')
    expect(normalizePath('/blog/')).toBe('/blog')
    expect(normalizePath('/blog//')).toBe('/blog')
    expect(normalizePath('/blog?page=2#top')).toBe('/blog')
    expect(normalizePath('blog/x')).toBe('/blog/x')
    expect(normalizePath('/Blog/X')).toBe('/Blog/X')
  })

  it('absoluteUrl: runtime origin, корень со слешем, остальное без', () => {
    expect(absoluteUrl('/')).toBe('https://demo.example/')
    expect(absoluteUrl('/blog/')).toBe('https://demo.example/blog')
    expect(absoluteUrl('/en/blog/x?y=1')).toBe('https://demo.example/en/blog/x')
  })

  it('absoluteUrl без SITE_URL — плейсхолдер сборки (штампуется при старте контейнера)', () => {
    vi.stubEnv('SITE_URL', '')
    expect(absoluteUrl('/blog')).toBe(`${SITE_ORIGIN_PLACEHOLDER}/blog`)
  })

  it('alternates: версия на каждом языке карты переводов, x-default — версия дефолтной локали', () => {
    expect(alternates(versions({ de: '/de/c', ru: '/blog/a', en: '/en/blog/b' }))).toEqual([
      { hreflang: 'ru', href: 'https://demo.example/blog/a' },
      { hreflang: 'en', href: 'https://demo.example/en/blog/b' },
      { hreflang: 'de', href: 'https://demo.example/de/c' },
      { hreflang: 'x-default', href: 'https://demo.example/blog/a' },
    ])
  })

  it('alternates: без версии дефолтной локали x-default — версия первой по порядку дескриптора', () => {
    expect(alternates(versions({ de: '/de/c', en: '/en/b' }))).toEqual([
      { hreflang: 'en', href: 'https://demo.example/en/b' },
      { hreflang: 'de', href: 'https://demo.example/de/c' },
      { hreflang: 'x-default', href: 'https://demo.example/en/b' },
    ])
  })

  it('alternates: версия одна или ни одной — hreflang нет вовсе, не self-only', () => {
    expect(alternates(versions({ ru: '/blog/a' }))).toEqual([])
    expect(alternates({})).toEqual([])
  })
})
