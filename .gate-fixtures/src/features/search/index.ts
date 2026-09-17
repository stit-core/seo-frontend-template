// Нарушение: импорт и объявление в баррели — top-level код тянет модуль в клиентский граф.
import { buildIndex } from './model/build'

export const searchIndex = buildIndex()
