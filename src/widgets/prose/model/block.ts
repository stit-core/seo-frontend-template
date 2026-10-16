import { defineBlock, list, text } from '@/shared/strategy'

export const prose = defineBlock({
  id: 'prose',
  variants: ['story'],
  slots: {
    title: text,
    // Абзацы раздела и пункты перечня под ними — по порядку плана.
    body: list(text),
    point: list(text).optional(),
  },
})
