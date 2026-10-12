// Шрифты дизайн-системы — файлы в репо, как принятые строки шрифтов манифеста продукта strategy
// (`font: {family, weight, style}` и файл WOFF2 с лицензией). Строка — один файл: начертание или его
// подмножество знаков. По списку Fonts API (astro.config.ts) печатает `@font-face` с метрическим
// фолбэком, а `<Font>` оболочки объявляет переменную семейства — на неё ссылаются роли файла
// токенов. Пусто — системные стеки файла токенов и 0 байт шрифтов. Модуль исполняет и Node без
// сборки (конфиг, seo:check), поэтому импортов у него нет.
export interface FontFile {
  // Первое имя стека гарнитуры в файле токенов.
  readonly family: string
  // Число или диапазон вариативного шрифта: '100 900'.
  readonly weight: number | `${number} ${number}`
  readonly style: 'normal' | 'italic' | 'oblique'
  // Путь от корня проекта; файлы шрифтов ДС лежат в src/app/styles/fonts/.
  readonly file: string
  // Знаки файла, когда начертание разрезано на подмножества (кириллица, латиница): браузер качает
  // только файл, чьи знаки есть на странице.
  readonly unicodeRange?: string
  // Начертание первого экрана: браузер качает его файлы заранее; preload на странице — не больше
  // двух файлов (seo:check).
  readonly preload?: true
}

export const FONTS: readonly FontFile[] = []

// Переменная семейства — форма производного CSS strategy (design README, «ДС»): `--font-` и имя
// строчными, каждый отрезок знаков вне латиницы и цифр — один дефис, дефисы по краям срезаются.
export const fontVariable = (family: string): string =>
  `--font-${family
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}`

// Вариант локального провайдера Fonts API — строка списка.
interface Variant {
  readonly src: [string]
  readonly weight: FontFile['weight']
  readonly style: FontFile['style']
  readonly unicodeRange?: [string]
}

const variantOf = ({ file, weight, style, unicodeRange }: FontFile): Variant => ({
  src: [file],
  weight,
  style,
  ...(unicodeRange !== undefined && { unicodeRange: [unicodeRange] }),
})

// Семейства списка — запись `fonts` конфига и `<Font>` оболочки на каждое. Preload Fonts API
// выбирает по начертанию: заранее качаются все файлы начертания первого экрана.
export function fontFamilies(fonts: readonly FontFile[] = FONTS) {
  const families = new Map<string, [Variant, ...Variant[]]>()
  for (const font of fonts) {
    const variants = families.get(font.family)
    if (variants === undefined) families.set(font.family, [variantOf(font)])
    else variants.push(variantOf(font))
  }
  return Array.from(families, ([family, variants]) => ({
    family,
    variable: fontVariable(family),
    variants,
    preload: fonts
      .filter((font) => font.family === family && font.preload)
      .map(({ weight, style }) => ({ weight, style })),
  }))
}

// Стек каждой переменной семейства в файле токенов — `var(--font-<ключ>, <стек>)`, имена без кавычек.
export const fontStacks = (tokens: string): Map<string, string[]> =>
  new Map(
    Array.from(
      tokens.matchAll(/var\((--font-[a-z0-9-]+),\s*([^)]+)\)/g),
      ([, variable = '', stack = '']) => [
        variable,
        stack.split(',').map((name) => name.trim().replace(/^(["'])(.*)\1$/, '$2')),
      ],
    ),
  )
