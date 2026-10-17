// Имя мини-проекта — бренд его организации в разметке: по нему seo:check узнаёт ссылку на неё без @id.
export const SITE_NAME = 'Фикстура'

// Локали мини-проекта seo:check — свои, а не локали сайта: гейт на гейт не зависит от того, на каких языках сайт.
export const LOCALES = [
  { code: 'ru', intl: 'ru-RU', og: 'ru_RU', name: 'Русский' },
  { code: 'en', intl: 'en-GB', og: 'en_US', name: 'English' },
]

// Реестр островов мини-проекта seo:check — свой, а не реестр сайта: гейт на гейт не меняется от
// того, какие острова у сайта. seo:check берёт из строки основание, страницы, бюджет и вид острова.
export const ISLANDS = {
  // Законный инлайн всего сайта; его кнопки — элементы с data-preference.
  preferences: {
    hash: 'sha256-fixture',
    basis: 'выбор темы и движения до первой отрисовки',
    pages: ['*'],
    markup: ['data-preference'],
    budget: 200,
  },
  // Законный остров-файл: модуль с импортом в бюджете — на главных обеих локалей и на /ostrova.
  karusel: {
    file: 'src/features/karusel/ui/karusel.astro',
    basis: 'момент спецификации движения главной: карусель кейсов',
    pages: ['/', '/ostrova'],
    budget: 300,
  },
  // Остров-файл, который с отложенным импортом тяжелее бюджета.
  tyazhelyy: {
    file: 'src/features/tyazhelyy/ui/tyazhelyy.astro',
    basis: 'момент спецификации движения: сцена первого экрана',
    pages: ['/ostrova'],
    budget: 200,
  },
  // Инлайн тяжелее бюджета.
  schyotchik: {
    hash: 'sha256-fixture',
    basis: 'счётчик посещений: решение проекта',
    pages: ['/ostrova'],
    budget: 60,
  },
  // Остров раздела: на /blog/raz он на месте, на /ostrova — вне своих страниц.
  razdel: {
    hash: 'sha256-fixture',
    basis: 'момент плана страниц блога',
    pages: ['/blog/*'],
    budget: 200,
  },
  // Строка без решения: ни основания, ни бюджета, ни вида.
  'bez-resheniya': { pages: [] },
}

// Список шрифтов мини-проекта: законный шрифт — Fonts API по строкам семейства Golos Text.
export const FONTS = [
  { family: 'Golos Text', weight: '400 900', style: 'normal', file: 'golos-latin.woff2', preload: true },
  { family: 'Golos Text', weight: '400 900', style: 'normal', file: 'golos-cyrillic.woff2', preload: true },
]
