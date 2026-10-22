import { METRIKA_ID, MOTION, THEME } from './site.ts'

// Острова: исполняемый код страницы — только строки этого реестра, без них на сайте ни байта JS.
// Строка — решение с основанием и ценой:
// - `basis` — момент спецификации движения или плана страницы, который остров исполняет;
// - `pages` — где он стоит: пути без префикса локали, `*` в конце — любое продолжение (`['*']` —
//   весь сайт, `[]` — нигде: такой остров CSP не пропускает);
// - `budget` — вес в brotli, байт: у инлайна — тег целиком, у файла — он и всё, что он импортирует.
//   Бюджет — норма, а не факт: факт с запасом 10 %, округлённый вверх до 25 Б, — иначе следующая правка
//   тела на одно выражение упрётся в потолок. Норму держит тест острова с обеих сторон: правка тела,
//   сдвинувшая её, меняет бюджет тем же диффом, что и хеш;
// - `hash` — остров-инлайн, `<script is:inline data-island>` в <head>: CSP пропускает тело по хешу.
//   Правка тела — новый хеш здесь (его печатает тест острова): изменение кода видно в диффе реестра;
// - `file` — остров-файл: компонент, чей `<script>` Astro собирает в модуль
//   `_astro/<имя>.astro_astro_type_script_…js`; CSP пропускает его как свой файл;
// - `markup` — атрибуты элементов, которые остров обслуживает: на странице без него они мертвы;
// - `sources` — чужие origin острова по директивам CSP.
// Реестр читают оболочка (где печатать остров), политика сборки (CSP) и seo:check; модуль исполняет и
// Node без сборки — поэтому импорт с расширением.
export interface Island {
  readonly basis: string
  readonly pages: readonly string[]
  readonly budget: number
  readonly hash?: string
  readonly file?: string
  readonly markup?: readonly string[]
  readonly sources?: Readonly<Partial<Record<string, readonly string[]>>>
}

export const ISLANDS = {
  preferences: {
    hash: 'sha256-Yzebn4pYJtvCqrXa+AvV0p64VtbbaJ3lP4GYz8VArk8=',
    basis:
      'выбор темы и движения встаёт до первой отрисовки: кнопка темы — поле THEME, переключатель движения — поле MOTION (эффект motion-toggle базы strategy)',
    // Выбор посетителя действует на всём сайте: остров стоит на каждой странице, когда сайт даёт выбор —
    // кнопку темы или переключатель движения; без выбора его нет нигде.
    pages: THEME.switcher || MOTION.switcher ? ['*'] : [],
    markup: ['data-theme-toggle', 'data-motion-set'],
    budget: 750,
  },
  // Согласие со счётчиком — один остров при заданном идентификаторе: пусто — ни баннера, ни сторонних скриптов на
  // сайте. Баннер — его разметка: «Принять» и «Отклонить» обслуживает он. tag.js, хиты и пиксель счётчика — с его
  // origin. Вебвизору, карте кликов и региональным доменам нужно больше — список Яндекса:
  // https://yandex.ru/support/metrica/code/install-counter-csp.html
  metrika: {
    hash: 'sha256-jAIiRUSseDiZkwfZRwe82CGtMR9TnG4yNlvAnqxtyjA=',
    basis:
      'согласие до счётчика: баннер cookie-banner каталога, счётчик посещений — после «Принять» (events.yaml#defaults.consent базы strategy); счётчик — решение проекта, идентификатор METRIKA_ID',
    pages: METRIKA_ID !== '' ? ['*'] : [],
    markup: ['data-consent-banner', 'data-consent'],
    budget: 700,
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
