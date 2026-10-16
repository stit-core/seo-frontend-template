import { z } from 'zod'
import { date, defineBlock, group, image, list, text } from '@/shared/strategy'

// Автор записи — человек реестра авторов: имя и роль на языке страницы, профиль — страница о нём, на неё ведёт подпись.
const person = z.strictObject({
  name: z.string(),
  jobTitle: z.string().optional(),
  profile: z.string(),
})

export const articleBody = defineBlock({
  id: 'article-body',
  variants: ['longread'],
  slots: {
    title: text,
    lead: text,
    // Ответ на вопрос статьи в начале и источники — элементы каталога; у записи блога их полей нет.
    summary: text.optional(),
    sources: text.optional(),
    // Даты записи — публикация и правка.
    date: z.strictObject({ published: date, updated: date.optional() }),
    author: person.optional(),
    cover: image.optional(),
    alt: text.optional(),
    // Разделы статьи из плана; текст записи коллекции — её Markdown: его блок получает содержимым.
    part: group({ heading: text, paragraph: list(text) }).optional(),
  },
})
