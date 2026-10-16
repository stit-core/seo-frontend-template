import { action, defineBlock, fact, list, text } from '@/shared/strategy'

export const contactDetails = defineBlock({
  id: 'contact-details',
  variants: ['compact'],
  slots: {
    title: text,
    // Контакты текстом — адрес, часы — строками по порядку плана.
    info: list(text),
    phone: action.optional(),
    email: action.optional(),
    // Реквизиты оператора — текст copy deck, который показывает факт company (binds плана); пробел в фактах — без
    // значения.
    legal: text.optional(),
    // Факты компании, которые называют тексты секции: оператор — реквизиты, часы работы — строку контактов с их временем.
    company: list(fact).optional(),
  },
})
