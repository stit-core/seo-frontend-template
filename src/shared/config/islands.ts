import { METRIKA_ID, THEME } from './site.ts'

// Острова: исполняемый код страницы — только строки этого реестра, без них на сайте ни байта JS.
// Строка — решение с основанием и ценой:
// - `basis` — момент спецификации движения или плана страницы, который остров исполняет;
// - `pages` — где он стоит: пути без префикса локали, `*` в конце — любое продолжение (`['*']` —
//   весь сайт, `[]` — нигде: такой остров CSP не пропускает);
// - `budget` — вес в brotli, байт: у инлайна — тег целиком, у файла — он и всё, что он импортирует.
//   Бюджет — цена решения, а не факт: при приёмке — факт с запасом не меньше 10 %, округлённый вверх до
//   25 Б, иначе следующая правка тела на одно выражение упрётся в потолок. Правка, съевшая запас, меняет
//   бюджет тем же диффом, что и хеш (запас держит тест острова);
// - `hash` — остров-инлайн, `<script is:inline data-island>` в <head>: CSP пропускает тело по хешу.
//   Правка тела — новый хеш здесь (его печатает тест острова): изменение кода видно в диффе реестра;
// - `file` — остров-файл: компонент, чей `<script>` Astro собирает в модуль
//   `_astro/<имя>.astro_astro_type_script_…js`; CSP пропускает его как свой файл;
// - `markup` — атрибут элементов, которые остров обслуживает: на странице без него они мертвы;
// - `sources` — чужие origin острова по директивам CSP.
// Реестр читают оболочка (где печатать остров), политика сборки (CSP) и seo:check; модуль исполняет и
// Node без сборки — поэтому импорт с расширением.
export interface Island {
  readonly basis: string
  readonly pages: readonly string[]
  readonly budget: number
  readonly hash?: string
  readonly file?: string
  readonly markup?: string
  readonly sources?: Readonly<Partial<Record<string, readonly string[]>>>
}

export const ISLANDS = {
  preferences: {
    hash: 'sha256-7VLt8Eq26z3tjG+dABk3Fdq6PMYYS8H+Cdc135LnYxQ=',
    basis:
      'выбор темы и движения встаёт до первой отрисовки: кнопка темы — поле THEME, переключатель движения — эффект motion-toggle базы strategy',
    // Без кнопки темы остров нужен только страницам с переключателем движения — их пути и встают сюда.
    pages: THEME.switcher ? ['*'] : [],
    markup: 'data-preference',
    budget: 725,
  },
  // Счётчик стоит только при заданном идентификаторе: пусто — сторонних скриптов на сайте нет.
  // tag.js, хиты и пиксель счётчика — с его origin. Вебвизору, карте кликов и региональным доменам
  // нужно больше — список Яндекса: https://yandex.ru/support/metrica/code/install-counter-csp.html
  metrika: {
    hash: 'sha256-14Iw2r5Y2q0vfD5FiTsyPGJGKyYCRHoQAMPZJ8TSEOQ=',
    basis: 'счётчик посещений: решение проекта — идентификатор METRIKA_ID',
    pages: METRIKA_ID !== '' ? ['*'] : [],
    budget: 325,
    sources: {
      'script-src': ['https://mc.yandex.ru'],
      'connect-src': ['https://mc.yandex.ru'],
      'img-src': ['https://mc.yandex.ru'],
    },
  },
} satisfies Record<string, Island>

// Стоит ли остров на странице: `route` — её путь без префикса локали (`routeOf`, shared/i18n).
export const standsOn = (island: Island, route: string): boolean =>
  island.pages.some((page) =>
    page.endsWith('*') ? route.startsWith(page.slice(0, -1)) : route === page,
  )
