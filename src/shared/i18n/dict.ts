import type { Locale } from './locale'

// Подписи интерфейса — каркас (переход к содержимому, лендмарки, тема и движение), страницы 410 и 500 без плана, блог
// (пагинация, заглушка, теги) и термины пар («часы работы», автор и даты записи) — словарь на каждую локаль
// дескриптора; микрокопия формы — словарь её фичи. Тексты страниц — copy deck strategy (меню, подвал, секции плана),
// записи — markdown-коллекции.
const ru = {
  'nav.label': 'Основная навигация',
  'nav.skip': 'К содержимому',
  'nav.breadcrumbs': 'Хлебные крошки',
  'theme.dark': 'Тёмная тема',
  'motion.label': 'Движение',
  'motion.system': 'Как в системе',
  'motion.reduced': 'Меньше',
  'motion.full': 'Полное',
  'footer.links': 'Ссылки подвала',
  'og.alt': '{site}',
  'error.home': 'На главную',
  'gone.title': 'Страница удалена',
  'gone.lead': 'Этот адрес больше не существует.',
  'error.title': 'Что-то сломалось',
  'error.lead': 'Сервер не смог собрать страницу. Обновите её через минуту.',
  'blog.feed': 'Блог — {site}',
  'blog.paged': '{text} — страница {page}',
  'blog.pagination': 'Страницы блога',
  'blog.newer': 'Новее',
  'blog.older': 'Старее',
  'blog.empty': 'Записей пока нет.',
  'blog.tags': 'Теги',
  'blog.tag': 'Записи с тегом #{tag}',
  'blog.tagDescription':
    'Записи с тегом #{tag} — заметки блога о быстрых индексируемых сайтах, от новых к старым.',
  'post.author': 'Автор',
  'post.published': 'Опубликовано',
  'post.updated': 'Обновлено',
  'company.hours': 'Часы работы',
}

const en = {
  'nav.label': 'Main navigation',
  'nav.skip': 'Skip to content',
  'nav.breadcrumbs': 'Breadcrumbs',
  'theme.dark': 'Dark theme',
  'motion.label': 'Motion',
  'motion.system': 'System',
  'motion.reduced': 'Reduced',
  'motion.full': 'Full',
  'footer.links': 'Footer links',
  'og.alt': '{site}',
  'error.home': 'Home',
  'gone.title': 'Page removed',
  'gone.lead': 'This address no longer exists.',
  'error.title': 'Something broke',
  'error.lead': 'The server could not build this page. Reload it in a minute.',
  'blog.feed': 'Blog — {site}',
  'blog.paged': '{text} — page {page}',
  'blog.pagination': 'Blog pages',
  'blog.newer': 'Newer',
  'blog.older': 'Older',
  'blog.empty': 'No posts yet.',
  'blog.tags': 'Tags',
  'blog.tag': 'Posts tagged #{tag}',
  'blog.tagDescription':
    'Posts tagged #{tag} — notes from the blog on fast, indexable sites, newest first.',
  'post.author': 'Author',
  'post.published': 'Published',
  'post.updated': 'Updated',
  'company.hours': 'Office hours',
}

export const DICTS = { ru, en } satisfies Record<Locale, Readonly<Record<string, string>>>

// Ключ строки — тот, что есть в словаре каждой локали: строку без перевода код не возьмёт (typecheck), а базового
// словаря нет — локаль уходит из сайта вместе со своим словарём.
export type DictKey = keyof (typeof DICTS)[Locale]

// Словари — на каждую локаль дескриптора: интерфейса (здесь) и слайсов (форма). Строка — по ключу на языке страницы,
// `{имя}` в строке — подстановка из `params`: порядок слов и место числа задаёт словарь языка, а не склейка в коде.
// Подстановки нет — ошибка сборки. Ключ из данных (поле формы каталога) проверяет `has`: ключи у словарей локалей одни
// (тест словаря), поэтому строка есть на каждом языке или ни на одном.
export function dictionary<D extends Record<Locale, Readonly<Record<string, string>>>>(dicts: D) {
  const keys = new Set(Object.values(dicts).flatMap((dict) => Object.keys(dict)))
  const text = (
    locale: Locale,
    key: keyof D[Locale] & string,
    params: Readonly<Record<string, string | number>> = {},
  ): string =>
    (dicts[locale][key] as string).replace(/\{(\w+)\}/g, (_, name: string) => {
      const value = params[name]
      if (value === undefined) throw new Error(`i18n: ${key} — нет подстановки {${name}}`)
      return String(value)
    })
  return Object.assign(text, {
    has: (key: string): key is keyof D[Locale] & string => keys.has(key),
  })
}

export const t = dictionary(DICTS)
