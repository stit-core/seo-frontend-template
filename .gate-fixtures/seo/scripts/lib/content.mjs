// Реестр мини-проекта seo:check — свой, а не реестр сайта: гейт на гейт не меняется от того,
// какие коллекции у сайта. seo:check берёт из записи имя, каталог и маршрут записи.
const entryRoute = (slug) => `/blog/${slug}`

export const collections = [
  { name: 'post', dir: 'src/entities/post/content', entryRoute },
  // Запись реестра без каталога.
  { name: 'bez-kataloga', dir: 'src/entities/bez-kataloga/content', entryRoute },
]
