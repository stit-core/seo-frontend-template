import { getRuntimeConfig, loadServerConfig, SITE_ORIGIN_PLACEHOLDER } from './runtime'

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
    KEEP_ALIVE_TIMEOUT_MS: 65_000,
    SHUTDOWN_TIMEOUT_MS: 15_000,
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

  it('таймауты обёртки сервера — целые миллисекунды больше нуля', () => {
    expect(
      getRuntimeConfig({ KEEP_ALIVE_TIMEOUT_MS: '70000', SHUTDOWN_TIMEOUT_MS: '2000' }),
    ).toMatchObject({ KEEP_ALIVE_TIMEOUT_MS: 70_000, SHUTDOWN_TIMEOUT_MS: 2_000 })
    for (const value of ['15s', '0', '-1', '1.5']) {
      expect(() => getRuntimeConfig({ SHUTDOWN_TIMEOUT_MS: value }), value).toThrow(
        'SHUTDOWN_TIMEOUT_MS',
      )
    }
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

  it('ошибка называет каждый неверный ключ и не печатает его значение', () => {
    const bad = { LOG_LEVEL: 'verbose', INDEXNOW_KEY: 'short', FORM_DELIVERY: 'email' }
    let message = ''
    try {
      getRuntimeConfig(bad)
    } catch (error) {
      message = (error as Error).message
    }
    for (const [key, value] of Object.entries(bad)) {
      expect(message).toContain(`${key}:`)
      expect(message).not.toContain(value)
    }
  })

  it('те же значения env разбираются один раз: запрос получает готовый объект', () => {
    const config = getRuntimeConfig({ LOG_LEVEL: 'debug' })
    expect(getRuntimeConfig({ LOG_LEVEL: 'debug' })).toBe(config)
    expect(getRuntimeConfig({ LOG_LEVEL: 'warn' }).LOG_LEVEL).toBe('warn')
  })
})

describe('loadServerConfig: env процесса, который отдаёт сайт', () => {
  it('без настоящего origin — отказ: пусто, не задано, плейсхолдер сборки', () => {
    for (const env of [{}, { SITE_URL: '' }, { SITE_URL: SITE_ORIGIN_PLACEHOLDER }]) {
      expect(() => loadServerConfig(env), JSON.stringify(env)).toThrow('SITE_URL')
    }
  })

  it('с настоящим origin — конфиг целиком, опечатка в любом ключе — отказ', () => {
    expect(loadServerConfig({ SITE_URL: 'https://demo.example/' }).SITE_URL).toBe(
      'https://demo.example',
    )
    expect(() =>
      loadServerConfig({ SITE_URL: 'https://demo.example', LOG_LEVEL: 'verbose' }),
    ).toThrow('LOG_LEVEL')
  })
})
