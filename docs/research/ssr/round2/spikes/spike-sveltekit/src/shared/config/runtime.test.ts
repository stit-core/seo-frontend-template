import { describe, expect, it } from 'vitest'
import { resolveOrigin, resolveRobotsPolicy } from './runtime'

describe('resolveOrigin', () => {
  it('срезает хвостовой слеш', () => {
    expect(resolveOrigin('https://a.example/', 'http://fb')).toBe('https://a.example')
  })
  it('падает на fallback при мусоре', () => {
    expect(resolveOrigin('not-a-url', 'http://fb')).toBe('http://fb')
    expect(resolveOrigin(undefined, 'http://fb')).toBe('http://fb')
  })
})

describe('resolveRobotsPolicy', () => {
  it('дефолт index', () => {
    expect(resolveRobotsPolicy(undefined)).toBe('index')
    expect(resolveRobotsPolicy('nope')).toBe('index')
  })
  it('распознаёт noindex', () => {
    expect(resolveRobotsPolicy('noindex')).toBe('noindex')
  })
})
