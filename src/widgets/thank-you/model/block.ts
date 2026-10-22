import { action, defineBlock, text, unshown } from '@/shared/strategy'

export const thankYou = defineBlock({
  id: 'thank-you',
  variants: ['page'],
  slots: {
    title: text,
    'next-steps': text,
    secondary: action.optional(),
    'secondary-label': text.optional(),
    // Канал для срочного вопроса — ссылка мессенджера; готовое сообщение несёт её адрес.
    channels: action.optional(),
    'messenger-prefill': unshown.optional(),
  },
})
