import { action, defineBlock, records, text } from '@/shared/strategy'

export const relatedLinks = defineBlock({
  id: 'related-links',
  variants: ['list'],
  slots: {
    title: text,
    // Связанные страницы кладёт страница по правилу «связанных» карты: план их не перечисляет.
    item: records({ link: action, title: text }),
  },
})
