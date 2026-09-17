import {
  getPublicConfig,
  getRuntimeConfig,
  PUBLIC_CONFIG_KEYS,
  SITE_ORIGIN_PLACEHOLDER,
} from './runtime'

describe('runtime config', () => {
  const defaults = {
    SITE_URL: SITE_ORIGIN_PLACEHOLDER,
    ROBOTS_POLICY: 'index',
    RELEASE: 'unknown',
    LOG_LEVEL: 'info',
  }

  it('без env даёт дефолты и плейсхолдер origin', () => {
    expect(getRuntimeConfig({})).toEqual(defaults)
  })

  it('пустая строка в env — «не задано» для каждого ключа', () => {
    expect(
      getRuntimeConfig({ SITE_URL: '', ROBOTS_POLICY: '', RELEASE: '', LOG_LEVEL: '' }),
    ).toEqual(defaults)
    expect(getRuntimeConfig({ SITE_URL: '' }).SITE_URL).toBe(SITE_ORIGIN_PLACEHOLDER)
    expect(getRuntimeConfig({ ROBOTS_POLICY: '' }).ROBOTS_POLICY).toBe('index')
    expect(getRuntimeConfig({ RELEASE: '' }).RELEASE).toBe('unknown')
    expect(getRuntimeConfig({ LOG_LEVEL: '' }).LOG_LEVEL).toBe('info')
  })

  it('срезает хвостовые слеши SITE_URL', () => {
    expect(getRuntimeConfig({ SITE_URL: 'https://demo.example/' }).SITE_URL).toBe(
      'https://demo.example',
    )
    expect(getRuntimeConfig({ SITE_URL: 'https://demo.example//' }).SITE_URL).toBe(
      'https://demo.example',
    )
  })

  it('отвергает невалидный SITE_URL и неизвестные значения enum', () => {
    expect(() => getRuntimeConfig({ SITE_URL: 'demo.example' })).toThrow()
    expect(() => getRuntimeConfig({ ROBOTS_POLICY: 'maybe' })).toThrow()
    expect(() => getRuntimeConfig({ LOG_LEVEL: 'trace' })).toThrow()
  })

  it('публичный конфиг — только whitelist ключей', () => {
    const publicConfig = getPublicConfig({ SITE_URL: 'https://demo.example', RELEASE: 'v1' })
    expect(Object.keys(publicConfig)).toEqual([...PUBLIC_CONFIG_KEYS])
    expect(publicConfig).not.toHaveProperty('RELEASE')
  })
})
