const t = (key: string, params: Readonly<Record<string, string>> = {}): string =>
  [key, ...Object.values(params)].join(' ')

// Нарушения: строка словаря склеена с другой — шаблонной строкой и через «+». Законно — подстановка `{имя}`.
export const paged = (page: string): string => `${t('blog.title')} — ${page}`
export const tagged = (tag: string): string => t('blog.tag') + tag
export const substituted = (page: string): string => t('blog.page', { page })
