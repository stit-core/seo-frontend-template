import { defineBlock, fact, group, list, text } from '@/shared/strategy'

export const legalText = defineBlock({
  id: 'legal-text',
  variants: ['privacy-policy'],
  slots: {
    title: text,
    // Дата редакции — текст copy deck: у факта даты нет значения для кода (machine), `<time>` ставить не с чем.
    date: text,
    // Оператор: наименование, ОГРН или ИНН, адрес — текст copy deck, который показывает факт company (binds плана).
    operator: text,
    company: fact.optional(),
    // Разделы документа по порядку плана: заголовок и абзацы.
    clause: group({ heading: text, text: list(text) }),
  },
})
