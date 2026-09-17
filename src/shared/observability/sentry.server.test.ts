// Клиент Sentry — мемоизированный промис модуля: без сброса модулей первый кейс решил бы
// исход всех остальных, и подменённый SENTRY_DSN никто бы не прочитал.
const captureServerError = async () =>
  (await import('./sentry')).captureServerError(new Error('сломалось'), {
    rid: 'test-rid',
    path: '/now',
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
    await expect(captureServerError()).resolves.toBeUndefined()
  })

  it('битый DSN не ломает ответ: сбой отправки остаётся внутри', async () => {
    vi.stubEnv('SENTRY_DSN', 'не-url')
    await expect(captureServerError()).resolves.toBeUndefined()
  })
})
