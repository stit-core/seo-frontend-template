import { SITE_ORIGIN_PLACEHOLDER } from '@/shared/config'
import { absoluteUrl, alternates, normalizePath } from './urls'

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

  it('alternates: взаимный набор с self и x-default на дефолтную локаль', () => {
    expect(alternates({ locale: 'ru', path: '/blog/a', alternatePath: '/blog/b' })).toEqual([
      { hreflang: 'ru', href: 'https://demo.example/blog/a' },
      { hreflang: 'en', href: 'https://demo.example/en/blog/b' },
      { hreflang: 'x-default', href: 'https://demo.example/blog/a' },
    ])
    expect(alternates({ locale: 'en', path: '/en/blog/b', alternatePath: '/blog/a' })).toEqual([
      { hreflang: 'ru', href: 'https://demo.example/blog/a' },
      { hreflang: 'en', href: 'https://demo.example/en/blog/b' },
      { hreflang: 'x-default', href: 'https://demo.example/blog/a' },
    ])
    expect(alternates({ locale: 'en', path: '/en', alternatePath: '/' })).toEqual([
      { hreflang: 'ru', href: 'https://demo.example/' },
      { hreflang: 'en', href: 'https://demo.example/en' },
      { hreflang: 'x-default', href: 'https://demo.example/' },
    ])
  })

  it('alternates: без перевода — пусто, не self-only', () => {
    expect(alternates({ locale: 'ru', path: '/blog/a', alternatePath: undefined })).toEqual([])
  })
})
