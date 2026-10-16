import { defineBlock, text, unshown, untargeted } from '@/shared/strategy'

export const leadForm = defineBlock({
  id: 'lead-form',
  variants: ['with-details'],
  slots: {
    title: text,
    lead: text,
    // Место формы: поля, проверку и обработчик даёт фича формы.
    form: untargeted,
    'cta-label': text,
    consent: text,
    'next-steps': text,
    success: unshown.optional(),
  },
})
