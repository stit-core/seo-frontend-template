import { action, defineBlock, group, text } from '@/shared/strategy'

export const notFound = defineBlock({
  id: 'not-found',
  variants: ['with-routes'],
  slots: {
    title: text,
    body: text,
    cta: action,
    'cta-label': text,
    // Пути на главные разделы сайта по порядку плана.
    route: group({ link: action, label: text }),
  },
})
