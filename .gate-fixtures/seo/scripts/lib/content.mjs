// Реестр мини-проекта seo:check — свой, а не реестр сайта: гейт на гейт не меняется от того,
// какие коллекции у сайта. seo:check берёт из записи имя, каталог, маршрут записи и страницы тега.
const entryRoute = (slug) => `/blog/${slug}`
const tagRoute = (tag) => `/blog/tag/${tag}`

export const collections = [
  { name: 'post', dir: 'src/entities/post/content', entryRoute, tagRoute },
  // Запись реестра без каталога.
  { name: 'bez-kataloga', dir: 'src/entities/bez-kataloga/content', entryRoute },
]
