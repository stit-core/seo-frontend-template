export const ru = {
  'nav.home': 'Главная',
  'nav.blog': 'Блог',
  'nav.about': 'О проекте',
  'nav.contact': 'Контакты',
  'home.title': 'Контентный сайт на Astro',
  'home.description':
    'Эталонный контент-сайт: prerender, острова, картинки AVIF/WebP, i18n и техническое SEO.',
  'home.hero': 'Индексируемый сайт без лишнего JavaScript',
  'home.lead':
    'Статика по умолчанию, серверный рендер там, где он нужен, и ноль килобайт скриптов на страницах без интерактива.',
  'home.cta': 'Читать блог',
  'home.latest': 'Свежие публикации',
  'blog.title': 'Блог',
  'blog.description': 'Заметки о рендеринге, индексируемости и производительности.',
  'blog.page': 'Страница',
  'blog.prev': 'Назад',
  'blog.next': 'Вперёд',
  'about.title': 'О проекте',
  'about.description': 'Зачем нужен шаблон контентного сайта и что он умеет.',
  'contact.title': 'Контакты',
  'contact.description': 'Напишите нам — форма отправляется на серверный обработчик.',
  'contact.thanksTitle': 'Заявка отправлена',
  'contact.thanks': 'Спасибо! Сообщение принято — мы ответим на указанный email.',
  'now.title': 'Сейчас',
  'notFound.title': '404 — страница не найдена',
  'notFound.lead': 'Проверьте адрес или вернитесь на главную.',
  'post.updated': 'Обновлено',
  'post.published': 'Опубликовано',
  'breadcrumbs.home': 'Главная',
} as const

export type Dict = Record<keyof typeof ru, string>
