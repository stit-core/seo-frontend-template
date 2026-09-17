import { beforeAll, describe, expect, it } from 'vitest'
import { absoluteUrl, alternatesFor, buildMetadata } from './metadata'

beforeAll(() => {
  process.env.SITE_URL = 'https://example.org'
  delete process.env.ROBOTS_POLICY
})

describe('shared/seo', () => {
  it('canonical абсолютный и внутри своей локали', () => {
    const ru = buildMetadata({ locale: 'ru', path: '/blog', title: 't', description: 'd' })
    const en = buildMetadata({ locale: 'en', path: '/blog', title: 't', description: 'd' })
    expect(ru.alternates?.canonical).toBe('https://example.org/blog')
    expect(en.alternates?.canonical).toBe('https://example.org/en/blog')
  })

  it('hreflang взаимный: обе локали + x-default', () => {
    expect(alternatesFor('/about').languages).toEqual({
      ru: 'https://example.org/about',
      en: 'https://example.org/en/about',
      'x-default': 'https://example.org/about',
    })
  })

  it('robots не смешивает разрешающую и запрещающую директиву', () => {
    const m = buildMetadata({
      locale: 'ru',
      path: '/now',
      title: 't',
      description: 'd',
      indexable: false,
    })
    expect(m.robots).toEqual({ index: false, follow: false })
  })

  it('ROBOTS_POLICY=noindex закрывает даже индексируемые страницы', () => {
    process.env.ROBOTS_POLICY = 'noindex'
    expect(buildMetadata({ locale: 'ru', path: '/', title: 't', description: 'd' }).robots).toEqual(
      {
        index: false,
        follow: false,
      },
    )
    delete process.env.ROBOTS_POLICY
  })

  it('og:image абсолютный', () => {
    const m = buildMetadata({
      locale: 'ru',
      path: '/blog/x',
      title: 't',
      description: 'd',
      type: 'article',
      image: absoluteUrl('/covers/x.png'),
    })
    const images = m.openGraph && 'images' in m.openGraph ? m.openGraph.images : undefined
    expect(JSON.stringify(images)).toContain('https://example.org/covers/x.png')
  })
})
