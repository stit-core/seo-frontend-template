import { describe, expect, it } from 'vitest'
import { absoluteUrl, alternateLinks, articleJsonLd, breadcrumbJsonLd, robotsContent } from './meta'

const ORIGIN = 'https://site.example'

describe('absoluteUrl', () => {
  it('ru без префикса, en с префиксом', () => {
    expect(absoluteUrl(ORIGIN, '/blog', 'ru')).toBe('https://site.example/blog')
    expect(absoluteUrl(ORIGIN, '/blog', 'en')).toBe('https://site.example/en/blog')
  })
  it('корень не получает двойного слеша', () => {
    expect(absoluteUrl(ORIGIN, '/', 'ru')).toBe('https://site.example/')
    expect(absoluteUrl(ORIGIN, '/', 'en')).toBe('https://site.example/en')
  })
  it('никогда не отдаёт относительный URL', () => {
    expect(absoluteUrl(ORIGIN, '/about', 'ru').startsWith('https://')).toBe(true)
  })
})

describe('alternateLinks', () => {
  it('взаимный набор ru/en/x-default', () => {
    const links = alternateLinks(ORIGIN, '/about')
    expect(links.map((l) => l.hreflang)).toEqual(['ru', 'en', 'x-default'])
    expect(links.at(-1)?.href).toBe('https://site.example/about')
  })
})

describe('robotsContent', () => {
  it('staging глушит индексацию даже для индексируемой страницы', () => {
    expect(robotsContent(true, 'index')).toBe('index, follow')
    expect(robotsContent(true, 'noindex')).toBe('noindex, nofollow')
    expect(robotsContent(false, 'index')).toBe('noindex, nofollow')
  })
})

describe('json-ld', () => {
  it('Article валиден и абсолютен', () => {
    const raw = articleJsonLd({
      origin: ORIGIN,
      path: '/blog/x',
      locale: 'ru',
      headline: 'H',
      description: 'D',
      datePublished: '2026-01-01',
      dateModified: '2026-02-01',
      image: '/cover.png',
    })
    const parsed = JSON.parse(raw)
    expect(parsed['@type']).toBe('Article')
    expect(parsed.image[0]).toBe('https://site.example/cover.png')
    expect(parsed.mainEntityOfPage['@id']).toBe('https://site.example/blog/x')
  })
  it('BreadcrumbList нумерует позиции с 1', () => {
    const parsed = JSON.parse(
      breadcrumbJsonLd(
        ORIGIN,
        [
          { name: 'A', path: '/' },
          { name: 'B', path: '/blog' },
        ],
        'en',
      ),
    )
    expect(parsed.itemListElement.map((i: { position: number }) => i.position)).toEqual([1, 2])
    expect(parsed.itemListElement[1].item).toBe('https://site.example/en/blog')
  })
})
