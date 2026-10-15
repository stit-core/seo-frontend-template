import { action, defineBlock, fact, group, list, text } from '@/shared/strategy'

export const footer = defineBlock({
  id: 'footer',
  variants: ['site', 'minimal'],
  slots: {
    // Реквизиты оператора — текст copy deck, который показывает факт company (binds плана); пробел в фактах — без
    // значения.
    legal: text,
    company: fact.optional(),
    // Правовые ссылки и их подписи — пары по порядку плана.
    privacy: list(action),
    'privacy-label': list(text),
    email: action.optional(),
    nav: group({ label: text, link: action }).optional(),
  },
})
