import type { Locale } from '@/shared/i18n'

export interface PostalAddress {
  postalCode: string
  locality: string
  street: string
}

// Идентичность оператора сайта: её печатает страница «О шаблоне», её же размечает
// LocalBusiness. Значения демонстрационные (домен example.com и телефон-пустышка) —
// /de-template заменяет их проектными, иначе демо уедет в прод.
export const COMPANY = {
  legalName: 'ООО «Пример»',
  email: 'hello@example.com',
  phone: '+7 495 000-00-00',
  // tel: терпит только цифры и плюс.
  phoneHref: '+74950000000',
  addressCountry: 'RU',
  address: {
    // Неразрывный пробел держит номер у слова: «офис 2» не рвётся висячей цифрой.
    ru: { postalCode: '101000', locality: 'Москва', street: 'ул.\u00a0Примерная, 1, офис\u00a02' },
    en: { postalCode: '101000', locality: 'Moscow', street: '1 Primernaya st., office\u00a02' },
  } satisfies Record<Locale, PostalAddress>,
  // Часы работы: строка Schema.org и та же мысль для человека.
  openingHours: 'Mo-Fr 10:00-19:00',
  hours: {
    ru: 'Пн–Пт, 10:00–19:00 (МСК)',
    en: 'Mon–Fri, 10:00–19:00 (MSK)',
  } satisfies Record<Locale, string>,
} as const
