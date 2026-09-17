import { describe, expect, it } from 'vitest'
import { absoluteUrl, alternates, localePath, stripLocale } from './urls'

describe('seo/urls', () => {
  it('дефолтная локаль без префикса', () => {
    expect(localePath('ru', '/blog')).toBe('/blog')
    expect(localePath('en', '/blog')).toBe('/en/blog')
    expect(localePath('en', '/')).toBe('/en')
  })

  it('canonical абсолютный и без хвостового слеша', () => {
    expect(absoluteUrl('/blog/')).toBe('http://localhost:3201/blog')
    expect(absoluteUrl('/')).toBe('http://localhost:3201/')
  })

  it('hreflang взаимный + x-default', () => {
    const list = alternates('/about')
    expect(list.map((a) => a.hreflang)).toEqual(['ru', 'en', 'x-default'])
    expect(list[1]?.href).toBe('http://localhost:3201/en/about')
  })

  it('срезает префикс локали', () => {
    expect(stripLocale('/en/blog')).toBe('/blog')
    expect(stripLocale('/en')).toBe('/')
    expect(stripLocale('/blog')).toBe('/blog')
  })
})
