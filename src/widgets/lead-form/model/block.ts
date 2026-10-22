import { action, defineBlock, form, text, unshown } from '@/shared/strategy'

export const leadForm = defineBlock({
  id: 'lead-form',
  variants: ['with-details'],
  slots: {
    title: text,
    lead: text,
    // Форма плана: набор полей каталога, проверку и обработчик даёт фича формы.
    form,
    'cta-label': text,
    consent: text,
    'next-steps': text,
    success: unshown.optional(),
    // Канал того же действия — ссылка мессенджера; готовое сообщение несёт её адрес.
    messenger: action.optional(),
    'messenger-prefill': unshown.optional(),
  },
})
