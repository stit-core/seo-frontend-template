// Ширина слота в контейнере секции — `sizes` картинки: по нему браузер выбирает файл до раскладки, а
// `var()` в `sizes` не читается. Поэтому длины берутся из ролей на сборке: модуль `virtual:slot-sizes`
// (плагин в astro.config.ts) — и замена файла токенов меняет `sizes` сама. Слот — ширина контейнера
// без полей страницы с двух сторон, у всего окна — окно.
type SlotWidth = 'reading' | 'page' | 'wide' | 'full'

// Ключи слоя, которые берёт контейнер: граница ширины (`max-w-*`) и поля страницы (`px-page-x`).
const BOUNDS = {
  reading: '--max-width-measure',
  page: '--max-width-container',
  wide: '--max-width-container-wide',
} as const
const PAGE_X = '--spacing-page-x'

// Длина, которую браузер прочтёт в `sizes`: число в rem или px — единицы размера DTCG.
const LENGTH = /^(\d+(?:\.\d+)?)(rem|px)$/

export function slotSizes(layer: string, tokens: string): Record<SlotWidth, string> {
  // Роль ключа — правая часть его строки в слое сопоставления (`--max-width-measure:
  // var(--size-measure)`), значение — строка роли в файле токенов (`--size-measure: 38rem`).
  const length = (key: string) => {
    const role = new RegExp(`(?<![\\w-])${key}:\\s*var\\((--[\\w-]+)\\)`).exec(layer)?.[1]
    if (role === undefined) {
      throw new Error(`sizes слота: у ключа ${key} нет роли в слое src/app/styles/index.css`)
    }
    const value = new RegExp(`(?<![\\w-])${role}:\\s*([^;]*);`).exec(tokens)?.[1]?.trim()
    if (value === undefined) {
      throw new Error(`sizes слота: роли ${role} нет в файле токенов src/app/styles/tokens.css`)
    }
    const match = LENGTH.exec(value)
    if (match === null) {
      throw new Error(
        `sizes слота: роль ${role} в файле токенов src/app/styles/tokens.css — «${value}», а не длина в rem или px`,
      )
    }
    return match
  }
  const [, pageX = '', unit = ''] = length(PAGE_X)
  const inset = `${2 * Number(pageX)}${unit}`
  const slot = (key: string) => {
    const [max] = length(key)
    return `(min-width: ${max}) calc(${max} - ${inset}), calc(100vw - ${inset})`
  }
  return {
    reading: slot(BOUNDS.reading),
    page: slot(BOUNDS.page),
    wide: slot(BOUNDS.wide),
    full: '100vw',
  }
}
