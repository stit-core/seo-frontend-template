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

// Значения, которые примет поле своего вида: правила набора на сервере судят вид и длину.
const VALUES: Readonly<Record<string, string>> = {
  text: 'Мария',
  email: 'maria@example.com',
  tel: '+7 900 000-00-00',
  textarea: 'Нужен сайт с блогом и формой заявки.',
}

// Заявка, которую примет форма набора: обязательные поля и первое поле «хотя бы одного из» — значения своего вида
// (вариант выбора — первый), согласие и скрытые поля сборки.
export function filledFormOf(form: LeadForm): Record<string, string> {
  const answered = form.fields.filter((field) => field.required || field.id === form.oneOf[0])
  return {
    ...Object.fromEntries(
      answered.map((field) => [field.id, field.options[0] ?? VALUES[field.type] ?? '']),
    ),
    consent: '1',
    form_id: form.id,
    page_url: form.page,
  }
}
