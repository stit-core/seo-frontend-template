import type { Locale } from './locale'

// Подписи интерфейса — каркас (переход к содержимому, лендмарки, тема и движение), страницы 410 и 500 без плана, блог,
// форма и термин пары «часы работы» — словарь на каждую локаль дескриптора. Тексты страниц — copy deck strategy (меню,
// подвал, секции плана), записи — markdown-коллекции.
const ru = {
  'nav.label': 'Основная навигация',
  'nav.skip': 'К содержимому',
  'nav.home': 'Главная',
  'nav.breadcrumbs': 'Хлебные крошки',
  'theme.dark': 'Тёмная тема',
  'motion.label': 'Движение',
  'motion.system': 'Как в системе',
  'motion.reduced': 'Меньше',
  'motion.full': 'Полное',
  'footer.links': 'Ссылки подвала',
  'og.alt': '{site} — шаблон индексируемого сайта',
  'error.home': 'На главную',
  'gone.title': 'Страница удалена',
  'gone.lead': 'Этот адрес больше не существует.',
  'error.title': 'Что-то сломалось',
  'error.lead': 'Сервер не смог собрать страницу. Обновите её через минуту.',
  'blog.title': 'Блог',
  'blog.pageTitle': 'Блог о быстрых индексируемых сайтах',
  'blog.description':
    'Короткие заметки о контентных сайтах: prerender, ноль JavaScript, честные статусы, canonical и hreflang, картинки, sitemap и один образ на все среды',
  'blog.lead': 'Заметки о том, как делать быстрые индексируемые сайты.',
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
  'post.published': 'Опубликовано',
  'post.updated': 'обновлено',
  'post.draft': 'Черновик',
  'author.by': 'Автор —',
  'company.hours': 'Часы работы',
  'form.name': 'Как вас зовут',
  'form.email': 'Почта для ответа',
  'form.message': 'Что нужно сделать',
  'form.consentPolicy': 'Политика обработки персональных данных',
  'form.honeypot': 'Не заполняйте это поле',
  'form.summary': 'Заявка не отправлена',
  'form.failed': 'Ошибка: {title}',
  'form.error.name': 'Имя — от 2 до 80 знаков.',
  'form.error.email': 'Адрес почты с @ и доменом: на него придёт ответ.',
  'form.error.message': 'Сообщение — от 10 до 2000 знаков.',
  'form.error.consent': 'Без согласия на обработку данных заявку принять нельзя.',
  'form.error.captcha': 'Проверка не пройдена. Отправьте форму ещё раз.',
  'form.error.delivery': 'Заявка не ушла: сбой доставки. Напишите на почту — адрес ниже.',
}

const en = {
  'nav.label': 'Main navigation',
  'nav.skip': 'Skip to content',
  'nav.home': 'Home',
  'nav.breadcrumbs': 'Breadcrumbs',
  'theme.dark': 'Dark theme',
  'motion.label': 'Motion',
  'motion.system': 'System',
  'motion.reduced': 'Reduced',
  'motion.full': 'Full',
  'footer.links': 'Footer links',
  'og.alt': '{site} — indexable site template',
  'error.home': 'Home',
  'gone.title': 'Page removed',
  'gone.lead': 'This address no longer exists.',
  'error.title': 'Something broke',
  'error.lead': 'The server could not build this page. Reload it in a minute.',
  'blog.title': 'Blog',
  'blog.pageTitle': 'Blog on fast, indexable sites',
  'blog.description':
    'Short notes on content sites: prerendering, zero JavaScript, honest status codes, canonical and hreflang, images, sitemaps and one image for every environment',
  'blog.lead': 'Notes on building fast, indexable sites.',
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
  'post.published': 'Published',
  'post.updated': 'updated',
  'post.draft': 'Draft',
  'author.by': 'By',
  'company.hours': 'Office hours',
  'form.name': 'Your name',
  'form.email': 'Email for the reply',
  'form.message': 'What you need',
  'form.consentPolicy': 'Personal data policy',
  'form.honeypot': 'Leave this field empty',
  'form.summary': 'The request was not sent',
  'form.failed': 'Error: {title}',
  'form.error.name': 'Name — from 2 to 80 characters.',
  'form.error.email': 'An email address with @ and a domain: the reply goes there.',
  'form.error.message': 'Message — from 10 to 2000 characters.',
  'form.error.consent': 'Without consent to data processing the request cannot be accepted.',
  'form.error.captcha': 'The check did not pass. Send the form again.',
  'form.error.delivery':
    'The request did not go through: delivery failed. Write to the email below.',
}

export const DICTS = { ru, en } satisfies Record<Locale, Readonly<Record<string, string>>>

// Ключ строки — тот, что есть в словаре каждой локали: строку без перевода код не возьмёт (typecheck), а базового
// словаря нет — локаль уходит из сайта вместе со своим словарём.
export type DictKey = keyof (typeof DICTS)[Locale]

// Строка словаря на языке страницы. `{имя}` в строке — подстановка из `params`: порядок слов и место числа задаёт
// словарь языка, а не склейка в коде. Подстановки нет — ошибка сборки.
export function t(
  locale: Locale,
  key: DictKey,
  params: Readonly<Record<string, string | number>> = {},
): string {
  return DICTS[locale][key].replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name]
    if (value === undefined) throw new Error(`i18n: ${key} — нет подстановки {${name}}`)
    return String(value)
  })
}
