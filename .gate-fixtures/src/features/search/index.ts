// Нарушение: импорт и объявление в баррели — баррель исполнял бы свой код у каждого импортёра.
import { buildIndex } from './model/build'

export const searchIndex = buildIndex()
