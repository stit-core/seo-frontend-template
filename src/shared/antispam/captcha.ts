import { getRuntimeConfig, type RuntimeConfig, type RuntimeEnv } from '@/shared/config'

export type CaptchaProvider = RuntimeConfig['CAPTCHA_PROVIDER']

export interface CaptchaVerifier {
  readonly provider: CaptchaProvider
  // true — пропустить заявку. Никогда не бросает: недоступность провайдера решает
  // CAPTCHA_FAIL_MODE (`open` — пропустить и записать в лог, `closed` — отказать).
  verify(token: string | null): Promise<boolean>
}

// Шов пятой ступени антиспам-лестницы. Реализаций провайдеров в шаблоне нет: `none`
// пропускает всё, а ступени honeypot → origin-check → валидация работают без JS и без
// внешних сервисов. Провайдер добавляется тремя правками: значение в enum
// `CAPTCHA_PROVIDER` (shared/config), реализация `verify` здесь и публичный site-key полем
// в `shared/config/site.ts` — публичному ключу в env делать нечего, prerendered его не видит.
export function getCaptchaVerifier(env?: RuntimeEnv): CaptchaVerifier {
  const { CAPTCHA_PROVIDER } = getRuntimeConfig(env)
  return { provider: CAPTCHA_PROVIDER, verify: () => Promise.resolve(true) }
}
