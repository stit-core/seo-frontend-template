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
    INDEXNOW_KEY: '',
    AI_TRAINING: 'allow',
  }

  it('без env даёт дефолты и плейсхолдер origin', () => {
    expect(getRuntimeConfig({})).toEqual(defaults)
  })

  it('пустая строка в env — «не задано» для каждого ключа', () => {
    expect(
      getRuntimeConfig({
        SITE_URL: '',
        ROBOTS_POLICY: '',
        RELEASE: '',
        LOG_LEVEL: '',
        INDEXNOW_KEY: '',
        AI_TRAINING: '',
      }),
    ).toEqual(defaults)
    expect(getRuntimeConfig({ SITE_URL: '' }).SITE_URL).toBe(SITE_ORIGIN_PLACEHOLDER)
    expect(getRuntimeConfig({ ROBOTS_POLICY: '' }).ROBOTS_POLICY).toBe('index')
    expect(getRuntimeConfig({ RELEASE: '' }).RELEASE).toBe('unknown')
    expect(getRuntimeConfig({ LOG_LEVEL: '' }).LOG_LEVEL).toBe('info')
    expect(getRuntimeConfig({ AI_TRAINING: '' }).AI_TRAINING).toBe('allow')
  })

  it('срезает хвостовые слеши SITE_URL', () => {
    expect(getRuntimeConfig({ SITE_URL: 'https://demo.example/' }).SITE_URL).toBe(
      'https://demo.example',
    )
    expect(getRuntimeConfig({ SITE_URL: 'https://demo.example//' }).SITE_URL).toBe(
      'https://demo.example',
    )
  })

  it('принимает ключ IndexNow и политику AI-краулеров как есть', () => {
    expect(getRuntimeConfig({ INDEXNOW_KEY: 'a1b2c3d4-e5f6', AI_TRAINING: 'deny' })).toMatchObject({
      INDEXNOW_KEY: 'a1b2c3d4-e5f6',
      AI_TRAINING: 'deny',
    })
  })

  it('отвергает невалидный SITE_URL, неизвестные значения enum и ключ IndexNow вне формата', () => {
    expect(() => getRuntimeConfig({ SITE_URL: 'demo.example' })).toThrow()
    expect(() => getRuntimeConfig({ ROBOTS_POLICY: 'maybe' })).toThrow()
    expect(() => getRuntimeConfig({ LOG_LEVEL: 'trace' })).toThrow()
    expect(() => getRuntimeConfig({ AI_TRAINING: 'block' })).toThrow()
    for (const INDEXNOW_KEY of ['short', 'с-кириллицей', 'has space', 'x'.repeat(129)]) {
      expect(() => getRuntimeConfig({ INDEXNOW_KEY }), INDEXNOW_KEY).toThrow()
    }
  })

  it('публичный конфиг — только whitelist ключей', () => {
    const publicConfig = getPublicConfig({
      SITE_URL: 'https://demo.example',
      RELEASE: 'v1',
      INDEXNOW_KEY: 'a1b2c3d4-e5f6',
    })
    expect(Object.keys(publicConfig)).toEqual([...PUBLIC_CONFIG_KEYS])
    expect(publicConfig).not.toHaveProperty('RELEASE')
    expect(publicConfig).not.toHaveProperty('INDEXNOW_KEY')
  })
})
