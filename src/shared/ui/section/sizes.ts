// Ширина слота в контейнере секции — `sizes` картинки: по нему браузер выбирает файл до раскладки.
// `var()` в `sizes` не читается, поэтому роли файла токенов здесь литералами: ширина контейнера
// (`size.measure`, `size.container`, `size.container-wide`) без полей страницы (`rhythm.page-x` с двух
// сторон), у всего окна — окно. Равенство ролям держит тест контейнера.
export const SLOT_SIZES = {
  reading: '(min-width: 38rem) 35rem, calc(100vw - 3rem)',
  page: '(min-width: 48rem) 45rem, calc(100vw - 3rem)',
  wide: '(min-width: 72rem) 69rem, calc(100vw - 3rem)',
  full: '100vw',
} as const satisfies Record<'reading' | 'page' | 'wide' | 'full', string>
