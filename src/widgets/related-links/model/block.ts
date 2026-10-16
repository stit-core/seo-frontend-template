import { action, defineBlock, group, text } from '@/shared/strategy'

export const relatedLinks = defineBlock({
  id: 'related-links',
  variants: ['list'],
  slots: {
    title: text,
    // Связанные страницы кладёт страница по правилу «связанных» карты: план их не перечисляет.
    item: group({ link: action, title: text }).optional(),
  },
})
