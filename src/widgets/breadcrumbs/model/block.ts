import { action, defineBlock, group, text } from '@/shared/strategy'

export const breadcrumbs = defineBlock({
  id: 'breadcrumbs',
  variants: ['full-path'],
  slots: {
    // Ступени пути от главной; текущая страница — без ссылки.
    crumb: group({ label: text, link: action }),
    current: text,
  },
})
