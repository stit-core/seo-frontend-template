import { defineBlock, group, text } from '@/shared/strategy'

export const featureGrid = defineBlock({
  id: 'feature-grid',
  variants: ['cards'],
  slots: {
    title: text,
    card: group({ title: text, body: text }),
  },
})
