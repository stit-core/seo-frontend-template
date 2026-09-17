import type { Locale } from './locale'

// Строки каркаса и обвязки контента (шапка, подвал, 404, блог); тексты страниц —
// в самих страницах и в markdown-коллекциях.
const ru = {
  'nav.label': 'Основная навигация',
  'nav.skip': 'К содержимому',
  'nav.blog': 'Блог',
  'lang.name': 'Русский',
  'footer.note': 'шаблон индексируемого сайта',
  'footer.now': 'время сервера',
  'notFound.title': 'Страница не найдена',
  'notFound.lead': 'Проверьте адрес или вернитесь на главную.',
  'notFound.home': 'На главную',
  'gone.title': 'Страница удалена',
  'gone.lead': 'Этот адрес больше не существует.',
  'blog.title': 'Блог',
  'blog.description':
    'Короткие заметки о контентных сайтах: prerender, ноль JavaScript, честные статусы, canonical и hreflang, картинки, sitemap и один образ на все среды',
  'blog.lead': 'Заметки о том, как делать быстрые индексируемые сайты.',
  'blog.page': 'страница',
  'blog.pagination': 'Страницы блога',
  'blog.newer': 'Новее',
  'blog.older': 'Старее',
  'blog.empty': 'Записей пока нет.',
  'blog.tags': 'Теги',
  'blog.tag': 'Тег',
  'blog.tagLead': 'Записи с тегом',
  'post.published': 'Опубликовано',
  'post.updated': 'обновлено',
  'post.draft': 'Черновик',
} as const

export type DictKey = keyof typeof ru
type Dict = Record<DictKey, string>

const en: Dict = {
  'nav.label': 'Main navigation',
  'nav.skip': 'Skip to content',
  'nav.blog': 'Blog',
  'lang.name': 'English',
  'footer.note': 'indexable site template',
  'footer.now': 'server time',
  'notFound.title': 'Page not found',
  'notFound.lead': 'Check the address or go back to the home page.',
  'notFound.home': 'Home',
  'gone.title': 'Page removed',
  'gone.lead': 'This address no longer exists.',
  'blog.title': 'Blog',
  'blog.description':
    'Short notes on content sites: prerendering, zero JavaScript, honest status codes, canonical and hreflang, images, sitemaps and one image for every environment',
  'blog.lead': 'Notes on building fast, indexable sites.',
  'blog.page': 'page',
  'blog.pagination': 'Blog pages',
  'blog.newer': 'Newer',
  'blog.older': 'Older',
  'blog.empty': 'No posts yet.',
  'blog.tags': 'Tags',
  'blog.tag': 'Tag',
  'blog.tagLead': 'Posts tagged',
  'post.published': 'Published',
  'post.updated': 'updated',
  'post.draft': 'Draft',
}

const DICTS: Record<Locale, Dict> = { ru, en }

export function t(locale: Locale, key: DictKey): string {
  return DICTS[locale][key]
}
