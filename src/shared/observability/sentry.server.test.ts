// Клиент Sentry — мемоизированный промис модуля: без сброса модулей первый кейс решил бы
// исход всех остальных, и подменённый SENTRY_DSN никто бы не прочитал.
const sentry = vi.hoisted(() => ({ init: vi.fn(), captureException: vi.fn() }))
vi.mock('@sentry/node', () => sentry)

const DSN = 'https://public@sentry.example/1'

const capture = async () =>
  (await import('./sentry')).captureServerError(new Error('сломалось'), {
    rid: 'test-rid',
    path: '/stranica',
  })

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('captureServerError', () => {
  it('без SENTRY_DSN ничего не грузит и не бросает', async () => {
    vi.stubEnv('SENTRY_DSN', '')
    await expect(capture()).resolves.toBeUndefined()
    expect(sentry.init).not.toHaveBeenCalled()
    expect(sentry.captureException).not.toHaveBeenCalled()
  })

  it('с SENTRY_DSN: клиент поднимается один раз, исключение уходит с rid и путём', async () => {
    vi.stubEnv('SENTRY_DSN', DSN)
    vi.stubEnv('SENTRY_ENVIRONMENT', 'staging')
    vi.stubEnv('RELEASE', 'v1.2.3')
    const { captureServerError } = await import('./sentry')
    const first = new Error('первое')
    const second = new Error('второе')
    await captureServerError(first, { rid: 'rid-1', path: '/stranica' })
    await captureServerError(second, { rid: 'rid-2', path: '/api/contact' })
    expect(sentry.init).toHaveBeenCalledOnce()
    expect(sentry.init).toHaveBeenCalledWith({
      dsn: DSN,
      environment: 'staging',
      release: 'v1.2.3',
      tracesSampleRate: 0,
      defaultIntegrations: false,
    })
    expect(sentry.captureException.mock.calls).toEqual([
      [first, { tags: { rid: 'rid-1', path: '/stranica' } }],
      [second, { tags: { rid: 'rid-2', path: '/api/contact' } }],
    ])
  })

  it('сбой клиента не ломает ответ: ошибка остаётся внутри', async () => {
    vi.stubEnv('SENTRY_DSN', 'не-url')
    sentry.init.mockImplementationOnce(() => {
      throw new Error('Invalid Sentry Dsn')
    })
    await expect(capture()).resolves.toBeUndefined()
    expect(sentry.captureException).not.toHaveBeenCalled()
  })
})
