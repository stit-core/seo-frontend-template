import { getCaptchaVerifier } from './captcha'

describe('шов капчи', () => {
  it('провайдер по умолчанию — none: проверка пропускает и без токена', async () => {
    const verifier = getCaptchaVerifier({})
    expect(verifier.provider).toBe('none')
    await expect(verifier.verify(null)).resolves.toBe(true)
    await expect(verifier.verify('какой-то-токен')).resolves.toBe(true)
  })

  it('неизвестный провайдер в env не проходит валидацию конфига', () => {
    expect(() => getCaptchaVerifier({ CAPTCHA_PROVIDER: 'smartcaptcha' })).toThrow()
  })
})
