import { dictionary, type Locale } from '@/shared/i18n'
import { fail } from '@/shared/strategy'
import { FORM_DICTS } from '../config/dict'

export const t = dictionary(FORM_DICTS)

// Заголовок окна ответа с отказом: первое слово называет отказ раньше страницы.
export const failedTitle = (locale: Locale, title: string): string => t(locale, 'failed', { title })

// Строка словаря по ключу из данных (поле и вариант набора, группа «хотя бы одно из»): её нет в словаре формы — ошибка
// сборки с ключом места, где она нужна.
export function textOf(locale: Locale, key: string, where: string): string {
  if (!t.has(key)) fail(where, `нет строки ${key} в словаре формы`)
  return t(locale, key)
}
