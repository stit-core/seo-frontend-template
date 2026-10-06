import { getRuntimeConfig, SITE_ORIGIN_PLACEHOLDER } from './runtime'

describe('runtime config', () => {
  const defaults = {
    SITE_URL: SITE_ORIGIN_PLACEHOLDER,
    ROBOTS_POLICY: 'index',
    RELEASE: 'unknown',
    LOG_LEVEL: 'info',
    INDEXNOW_KEY: '',
    AI_TRAINING: 'allow',
    SENTRY_DSN: '',
    SENTRY_ENVIRONMENT: 'production',
    FORM_DELIVERY: 'smtp',
    FORM_BACKEND_URL: '',
    SMTP_URL: '',
    FORM_TO: '',
    FORM_FROM: '',
    CAPTCHA_PROVIDER: 'none',
    CAPTCHA_SECRET: '',
    CAPTCHA_FAIL_MODE: 'open',
  }

  it('без env даёт дефолты и плейсхолдер origin', () => {
    expect(getRuntimeConfig({})).toEqual(defaults)
  })

  it('пустая строка в env — «не задано» для каждого ключа', () => {
    const empty = Object.fromEntries(Object.keys(defaults).map((key) => [key, '']))
    expect(getRuntimeConfig(empty)).toEqual(defaults)
    expect(getRuntimeConfig({ SITE_URL: '' }).SITE_URL).toBe(SITE_ORIGIN_PLACEHOLDER)
    expect(getRuntimeConfig({ ROBOTS_POLICY: '' }).ROBOTS_POLICY).toBe('index')
    expect(getRuntimeConfig({ RELEASE: '' }).RELEASE).toBe('unknown')
    expect(getRuntimeConfig({ LOG_LEVEL: '' }).LOG_LEVEL).toBe('info')
    expect(getRuntimeConfig({ AI_TRAINING: '' }).AI_TRAINING).toBe('allow')
    expect(getRuntimeConfig({ FORM_DELIVERY: '' }).FORM_DELIVERY).toBe('smtp')
    expect(getRuntimeConfig({ CAPTCHA_FAIL_MODE: '' }).CAPTCHA_FAIL_MODE).toBe('open')
  })

  it('секреты формы и Sentry принимаются как есть, канал доставки — из списка', () => {
    expect(
      getRuntimeConfig({
        FORM_DELIVERY: 'backend',
        FORM_BACKEND_URL: 'http://api.internal/leads',
        FORM_TO: 'sales@example.com',
        SENTRY_DSN: 'https://key@sentry.example/1',
        SENTRY_ENVIRONMENT: 'staging',
      }),
    ).toMatchObject({
      FORM_DELIVERY: 'backend',
      FORM_BACKEND_URL: 'http://api.internal/leads',
      FORM_TO: 'sales@example.com',
      SENTRY_DSN: 'https://key@sentry.example/1',
      SENTRY_ENVIRONMENT: 'staging',
    })
    expect(() => getRuntimeConfig({ FORM_DELIVERY: 'telegram' })).toThrow()
    expect(() => getRuntimeConfig({ CAPTCHA_PROVIDER: 'smartcaptcha' })).toThrow()
    expect(() => getRuntimeConfig({ CAPTCHA_FAIL_MODE: 'half' })).toThrow()
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
})
