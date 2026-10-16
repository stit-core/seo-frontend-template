import { action, defineBlock, text } from '@/shared/strategy'

export const thankYou = defineBlock({
  id: 'thank-you',
  variants: ['page'],
  slots: {
    title: text,
    'next-steps': text,
    secondary: action.optional(),
    'secondary-label': text.optional(),
  },
})
