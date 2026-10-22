import type { LeadForm } from '@/shared/strategy'

// Формы тестов фичи формы: набор contact-message каталога (поля по порядку, «хотя бы одно из» — почта или телефон) на странице
// контактов; варианты канала — звонок и почта.
export const LEAD_FORM: LeadForm = {
  id: 'contacts/lead-form',
  set: 'contact-message',
  fields: [
    {
      id: 'name',
      type: 'text',
      required: false,
      autocomplete: 'name',
      inputmode: undefined,
      spellcheck: undefined,
      options: [],
    },
    {
      id: 'email',
      type: 'email',
      required: false,
      autocomplete: 'email',
      inputmode: undefined,
      spellcheck: false,
      options: [],
    },
    {
      id: 'phone',
      type: 'tel',
      required: false,
      autocomplete: 'tel',
      inputmode: 'tel',
      spellcheck: undefined,
      options: [],
    },
    {
      id: 'contact-channel',
      type: 'radio',
      required: false,
      autocomplete: undefined,
      inputmode: undefined,
      spellcheck: undefined,
      options: ['call', 'email'],
    },
    {
      id: 'task',
      type: 'textarea',
      required: true,
      autocomplete: undefined,
      inputmode: undefined,
      spellcheck: undefined,
      options: [],
    },
  ],
  oneOf: ['email', 'phone'],
  honeypot: 'company-website',
  server: ['utm_source', 'yclid', 'gclid'],
  page: '/contacts',
  thankYou: { href: '/contacts/spasibo' },
  marketingConsent: false,
}

// Набор callback каталога: телефон обязателен.
export const CALLBACK_FORM: LeadForm = {
  ...LEAD_FORM,
  id: 'home/callback',
  set: 'callback',
  fields: [
    {
      id: 'phone',
      type: 'tel',
      required: true,
      autocomplete: 'tel',
      inputmode: 'tel',
      spellcheck: undefined,
      options: [],
    },
    {
      id: 'name',
      type: 'text',
      required: false,
      autocomplete: 'name',
      inputmode: undefined,
      spellcheck: undefined,
      options: [],
    },
  ],
  oneOf: [],
}
