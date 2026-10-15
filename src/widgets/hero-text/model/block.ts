import { action, defineBlock, text } from '@/shared/strategy'

export const heroText = defineBlock({
  id: 'hero-text',
  variants: ['statement-cta'],
  slots: {
    headline: text,
    subheadline: text,
    cta: action,
    'cta-label': text,
    'cta-secondary': action.optional(),
    'cta-secondary-label': text.optional(),
  },
})
