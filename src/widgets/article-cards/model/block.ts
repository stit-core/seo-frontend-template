import { action, date, defineBlock, group, text } from '@/shared/strategy'

export const articleCards = defineBlock({
  id: 'article-cards',
  variants: ['list'],
  slots: {
    title: text,
    all: action.optional(),
    'all-label': text.optional(),
    // Записи коллекции: их кладёт страница из запроса коллекции, план их не заполняет.
    article: group({ title: text, date, link: action, excerpt: text.optional() }).optional(),
  },
})
