import { readdirSync, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseForESLint } from 'astro-eslint-parser'
import { compile } from 'tailwindcss'
import tseslint from 'typescript-eslint'
import { THEME } from '@/shared/config'

// Токен-слой компилируется, как на сборке, и классы проверяются выводом компилятора, а не CSS
// сборки: сборка печатает только использованные утилиты, и вернувшаяся палитра в ней не видна,
// пока её класс не попал в разметку.
const entry = fileURLToPath(new URL('./index.css', import.meta.url))
const layer = await readFile(entry, 'utf8')
const tokens = await readFile(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8')
const require = createRequire(import.meta.url)
const compileLayer = () =>
  compile(layer, {
    base: dirname(entry),
    loadStylesheet: async (id, base) => {
      const path =
        id === 'tailwindcss' ? require.resolve('tailwindcss/index.css') : resolve(base, id)
      return { path, base: dirname(path), content: await readFile(path, 'utf8') }
    },
  })
const compiler = await compileLayer()
// Компилятор копит классы всех вызовов: «класс не дал CSS» — вывод равен выводу до него.
const adds = (classes: string[]) => compiler.build([]) !== compiler.build(classes)
// Объявления, которые утилита даёт своему классу: у роли текста их два блока — гарнитура от утилиты
// `text-*` слоя и остальное от Tailwind.
const rule = (utility: string) =>
  Array.from(
    compiler.build([utility]).matchAll(new RegExp(`\\.${utility}\\s*\\{([^}]*)\\}`, 'g')),
    ([, body = '']) => body,
  ).join('')
// Переменная ДС, которую утилита роли кладёт в своё свойство.
const roleOf = (utility: string) => /var\((--[\w-]+)\)/.exec(rule(utility))?.[1] ?? utility
// Свойство утилита берёт у роли — какой именно, решает строка слоя, а не тест.
const fromRole = (utility: string, property: string) =>
  new RegExp(`(?<![\\w-])${property}: var\\(--[\\w-]+`).test(rule(utility))

const declared = (source: string) => new Set(source.match(/--[\w-]+(?=\s*:)/g))
const referenced = (source: string) =>
  new Set(Array.from(source.matchAll(/var\((--[\w-]+)/g), ([, name = '']) => name))
// Значения объявлений color-scheme; `prefers-color-scheme` медиа-условия — не объявление.
const colorSchemes = (source: string) =>
  Array.from(source.matchAll(/(?<![\w-])color-scheme:\s*([^;{}]+)/g), ([, value = '']) => value)

type Values = Map<string, string>
type Theme = readonly [name: string, values: Values]
type Site = { readonly default: string; readonly switcher: boolean }

// Блоки файла токенов в форме ds_build: условие @media, селектор и объявления.
const blocksOf = (css: string) =>
  Array.from(
    css
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .matchAll(/(?:@media\s*([^{]+?)\s*\{\s*)?([^{}@]+?)\s*\{([^{}]*)\}/g),
    ([, media = '', selector = '', body = '']) => ({
      media,
      selector: selector.trim(),
      values: new Map(
        Array.from(
          body.matchAll(/([\w-]+)\s*:\s*([^;]+);/g),
          ([, name = '', value = '']) => [name, value.trim()] as const,
        ),
      ),
    }),
  )

// Темы файла токенов — `color-scheme` блока `:root`: первая — тема значений, парную включают
// система (без выбора) и атрибут `data-theme` (выбор). Выбор атрибутом несёт и `color-scheme` темы
// — иначе системные элементы (флажок, полосы прокрутки) остаются в теме системы. `themes` — имя и
// значения переменных каждой темы, `faults` — чем блоки тем расходятся с этой формой.
function themesOf(css: string) {
  const blocks = blocksOf(css)
  const find = (media: string, selector: string) =>
    blocks.find((block) => block.media === media && block.selector === selector)?.values
  const root = find('', ':root') ?? new Map<string, string>()
  const [base = '', ...pairs] = (root.get('color-scheme') ?? '').split(' ')
  const byAttribute = (theme: string) => find('', `:root[data-theme="${theme}"]`)
  const bySystem = (theme: string) =>
    find(`(prefers-color-scheme: ${theme})`, `:root:not([data-theme="${base}"])`)
  const known = new Set([
    byAttribute(base),
    ...pairs.flatMap((pair) => [byAttribute(pair), bySystem(pair)]),
  ])
  const lacksScheme = (theme: string) => byAttribute(theme)?.get('color-scheme') !== theme
  const faults = [
    ...(base === '' ? ['у :root нет color-scheme'] : []),
    ...blocks
      .filter(({ media, selector }) => /prefers-color-scheme|data-theme/.test(media + selector))
      .filter(({ values }) => !known.has(values))
      .map(({ media, selector }) =>
        `блок темы вне color-scheme :root: ${media} ${selector}`.replace(/ +/g, ' '),
      ),
    ...pairs.flatMap((pair) => {
      const [attribute, system] = [byAttribute(pair), bySystem(pair)]
      if (!attribute || !system) return [`тема ${pair}: нет блока по атрибуту или по системе`]
      return [...new Set([...attribute.keys(), ...system.keys()])]
        .filter((name) => attribute.get(name) !== system.get(name))
        .map(
          (name) =>
            `тема ${pair}, ${name}: по атрибуту ${attribute.get(name)}, по системе ${system.get(name)}`,
        )
    }),
    // У файла с одной темой выбирать не из чего: блок темы значений по атрибуту ему не нужен.
    ...[...(pairs.length > 0 ? [base] : []), ...pairs.filter((pair) => byAttribute(pair))]
      .filter(lacksScheme)
      .map((theme) => `блок :root[data-theme="${theme}"] не объявляет color-scheme ${theme}`),
  ]
  const themes: [Theme, ...Theme[]] = [
    [base, root],
    ...pairs.map((pair) => [pair, new Map([...root, ...(byAttribute(pair) ?? [])])] as const),
  ]
  return { themes, faults }
}

// Темы, которые сайт берёт у дизайн-системы: кнопка выбора и тема по системе — это обе темы.
const themesOfSite = (site: Site) =>
  site.default === 'system' || site.switcher ? ['light', 'dark'] : [site.default]

// Пары «что — на чём», как их кладёт разметка сайта. Текст — 4,5:1 (WCAG 1.4.3); граница поля,
// заливка действия, черта состояния (текущий раздел, нажатая кнопка) и кольцо фокуса — 3:1
// (WCAG 1.4.11).
const PAIRS = [
  ['text-primary', 'bg-canvas', 4.5],
  ['text-primary', 'bg-surface', 4.5],
  ['text-primary', 'bg-subtle', 4.5],
  ['text-primary', 'bg-accent', 4.5],
  ['text-primary', 'bg-danger', 4.5],
  ['text-secondary', 'bg-canvas', 4.5],
  ['text-secondary', 'bg-surface', 4.5],
  ['text-secondary', 'bg-subtle', 4.5],
  ['text-accent', 'bg-canvas', 4.5],
  ['text-accent', 'bg-accent', 4.5],
  ['text-accent', 'bg-danger', 4.5],
  ['text-on-accent', 'bg-accent-solid', 4.5],
  ['text-on-accent', 'bg-accent-solid-hover', 4.5],
  ['text-danger', 'bg-canvas', 4.5],
  ['text-danger', 'bg-accent', 4.5],
  ['border-strong', 'bg-canvas', 3],
  ['border-strong', 'bg-surface', 3],
  ['border-danger', 'bg-canvas', 3],
  ['border-danger', 'bg-surface', 3],
  ['bg-accent-solid', 'bg-canvas', 3],
  ['decoration-accent', 'bg-canvas', 3],
  ['bg-accent-solid-hover', 'bg-canvas', 3],
  ['outline-focus-ring', 'bg-canvas', 3],
  ['outline-focus-ring', 'bg-surface', 3],
  ['outline-focus-ring', 'bg-accent', 3],
  ['outline-focus-ring', 'bg-danger', 3],
] as const

// Относительная яркость цвета sRGB и контраст пары (WCAG 2.2).
const luminance = (hex: string) => {
  const [red = 0, green = 0, blue = 0] = [1, 3, 5]
    .map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}
const contrast = (front: string, back: string) => {
  const [light = 0, dark = 0] = [luminance(front), luminance(back)].sort((a, b) => b - a)
  return (light + 0.05) / (dark + 0.05)
}

// Пары ниже порога в каждой теме. Значение не в `#rrggbb` контраст не даёт — оно тоже названо.
const contrastFaults = (
  themes: readonly Theme[],
  pairs: ReadonlyArray<readonly [string, string, number]>,
  variable = (name: string) => name,
) =>
  themes.flatMap(([theme, values]) =>
    pairs.flatMap(([front, back, least]) => {
      const colors = [front, back].map((name) => values.get(variable(name)) ?? 'нет значения')
      const [above = '', below = ''] = colors
      if (!colors.every((color) => /^#[\da-f]{6}$/i.test(color))) {
        return [`${theme}: ${front} на ${back} — не #rrggbb (${above} на ${below})`]
      }
      const ratio = contrast(above, below)
      return ratio < least
        ? [`${theme}: ${front} на ${back} — ${ratio.toFixed(2)}:1, порог ${least}:1`]
        : []
    }),
  )

it('тема Tailwind по умолчанию выключена: её классы не дают CSS, утилита роли — даёт', () => {
  const closed = [
    ...['text-zinc-500', 'bg-red-600', 'text-white', 'border-black', 'font-mono'],
    ...['text-xl', 'font-semibold', 'tracking-tight', 'leading-tight'],
    ...['mt-4', 'px-6', 'gap-x-8', 'w-40', 'size-4', '-mr-2'],
    ...['rounded-md', 'max-w-prose', 'sm:hidden', 'lg:hidden', 'shadow-md'],
    ...['ease-in', 'animate-spin'],
  ]
  expect(closed.filter((utility) => adds([utility]))).toEqual([])
  expect(fromRole('text-secondary', 'color')).toBe(true)
})

it('утилита роли — только своего свойства: роль фона не красит текст', () => {
  expect(adds(['text-canvas', 'bg-secondary', 'border-canvas'])).toBe(false)
  expect(fromRole('bg-canvas', 'background-color')).toBe(true)
})

it('роль текста — одна утилита: гарнитура, кегль, интерлиньяж, насыщенность и трекинг', () => {
  const roles = Array.from(
    layer.matchAll(/--text-((?!color-|decoration-|underline-)[a-z]+(?:-[a-z]+)*):/g),
    ([, role = '']) => role,
  )
  const parts = ['font-family', 'font-size', 'line-height', 'font-weight', 'letter-spacing']
  expect(roles).toContain('body')
  expect(roles.filter((role) => !parts.every((part) => fromRole(`text-${role}`, part)))).toEqual([])
})

it('отступ — шаг шкалы и ритм файла токенов', () => {
  expect(fromRole('mt-md', 'margin-top')).toBe(true)
  expect(fromRole('px-page-x', 'padding-inline')).toBe(true)
})

it('длительность и кривая перехода — роли движения файла токенов', () => {
  for (const duration of ['duration-hover', 'duration-page']) {
    expect(fromRole(duration, 'transition-duration'), duration).toBe(true)
  }
  for (const curve of ['ease-out', 'ease-in-out']) {
    expect(fromRole(curve, 'transition-timing-function'), curve).toBe(true)
  }
})

// Условие варианта — норма эффекта motion-toggle базы strategy: движение идёт, когда система не
// просит его сократить и посетитель не выбрал «меньше», и когда он выбрал «полное» вопреки системе.
it('вариант motion: движение разрешено системой без выбора «меньше» или выбором «полное»', () => {
  const css = compiler.build(['motion:hidden']).replace(/\s+/g, ' ')
  const reduced = String.raw`\[data-motion="reduced"\]`
  const full = String.raw`\[data-motion="full"\]`
  const own = String.raw`\.motion\\:hidden`
  expect(css).toMatch(
    new RegExp(
      String.raw`@media \(prefers-reduced-motion: no-preference\) \{ ${own}:not\(:where\(${reduced}, ${reduced} \*\)\) \{ display: none; \} \}`,
    ),
  )
  expect(css).toMatch(
    new RegExp(String.raw`\} ${own}:where\(${full}, ${full} \*\) \{ display: none; \}`),
  )
  expect(css.match(new RegExp(own, 'g'))).toHaveLength(2)
})

// Условие @media не читает var(): границу слой повторяет значением, и расхождение с файлом
// токенов дало бы раскладке сайта другую ширину, чем у дизайн-системы.
it('границы раскладки слоя — breakpoint.* файла токенов', () => {
  const breakpoints = (source: string) =>
    new Map(
      Array.from(
        source.matchAll(/--breakpoint-([\w-]+):\s*([^;]+);/g),
        ([, name = '', value = '']) => [name, value] as const,
      ),
    )
  const names = [...breakpoints(layer).keys()]
  // Ширина, с которой вариант включается в скомпилированном CSS.
  const widthOf = (name: string) =>
    new RegExp(`@media \\(width >= ([^)]+)\\) \\{\\s*\\.${name}\\\\:hidden`).exec(
      compiler.build([`${name}:hidden`]),
    )?.[1]
  expect(names).toEqual(['tablet', 'desktop'])
  expect(names.map((name) => `${name}: ${widthOf(name)}`)).toEqual(
    names.map((name) => `${name}: ${breakpoints(tokens).get(name)}`),
  )
})

it('color-scheme объявляет только файл токенов', () => {
  expect(colorSchemes(compiler.build([]))).toEqual(colorSchemes(tokens))
})

// Слой — блок `@theme inline` (строки «ключ утилиты: роль») и правила под ним: базовые стили и
// классы-компоненты на `@apply` тех же утилит.
const source = layer.replace(/\/\*[\s\S]*?\*\//g, '')
const THEME_BLOCK = /@theme inline \{([^}]*)\}/
const mapping = Array.from(
  (THEME_BLOCK.exec(source)?.[1] ?? '').matchAll(/(--[\w*-]+):\s*([^;]+);/g),
  ([, key = '', value = '']) => [key, value.trim()] as const,
)

// Значение, зашитое в строку слоя, замена файла токенов не переодела бы. Свои значения — у сброса
// темы, нуля и границ раскладки (их равенство файлу держит тест выше); колонка сетки — раскладка.
it('строка слоя сопоставления — роль файла токенов, а не значение', () => {
  const own = /^--(?:\*|spacing-0|breakpoint-[\w-]+)$/
  expect(mapping.length).toBeGreaterThan(0)
  expect(
    mapping
      .filter(([key]) => !own.test(key))
      .filter(([, value]) => value.replace(/var\(--[\w-]+\)|minmax\(0, 1fr\)/g, '').trim() !== '')
      .map(([key, value]) => `${key}: ${value}`),
  ).toEqual([])
})

// Правило слоя берёт значение утилитой роли (`@apply`): число в его объявлении — литерал мимо
// роли. Своё число — у ширины поля.
it('число в правилах слоя — только названные литералы', () => {
  const rules = source.replace(THEME_BLOCK, '').replace(/@apply[^;]*;/g, '')
  expect(
    Array.from(
      rules.matchAll(/([\w-]+)\s*:\s*([^;{}]*[1-9][^;{}]*);/g),
      ([, property = '', value = '']) => `${property}: ${value.trim()}`,
    ),
  ).toEqual(['width: 100%'])
})

// Правила слоя без блоков варианта `motion` — то, что действует при любом выборе движения.
function withoutMotion(css: string) {
  let rest = ''
  let from = 0
  for (const { index, 0: opener } of css.matchAll(/@(?:custom-)?variant motion\s*\{/g)) {
    if (index < from) continue
    let end = index + opener.length
    for (let depth = 1; depth > 0 && end < css.length; end += 1) {
      if (css[end] === '{') depth += 1
      else if (css[end] === '}') depth -= 1
    }
    rest += css.slice(from, index)
    from = end
  }
  return rest + css.slice(from)
}

// Движение правило слоя объявляет «от статики» — под вариантом `motion` (блок `@variant motion`,
// утилита `motion:` в `@apply`): вне его остаются статика и отклик без смещения — переход цвета и
// прозрачности. Правило мимо варианта двигалось бы и у посетителя, который просил движение
// сократить; сокращённая запись `transition` несла бы длительность мимо роли.
it('движение в правилах слоя — только под вариантом motion', () => {
  const rules = withoutMotion(source.replace(THEME_BLOCK, ''))
  const still =
    /^(?:none|(?:background-|border-|outline-|text-decoration-)?color|fill|stroke|opacity)$/
  const moves = new Map<string, (value: string) => boolean>([
    ['animation', (value) => value !== 'none'],
    ['animation-name', (value) => value !== 'none'],
    ['transition', () => true],
    ['transition-property', (value) => !value.split(/\s*,\s*/).every((name) => still.test(name))],
    ['scroll-behavior', (value) => value !== 'auto'],
    ['view-transition-name', (value) => value !== 'none'],
  ])
  const declared = Array.from(
    rules.matchAll(/(?<![\w-])([a-z-]+)\s*:\s*([^;{}]+);/g),
    ([, property = '', value = '']) => [property, value.trim()] as const,
  ).filter(([property, value]) => moves.get(property)?.(value))
  const moving = /^(?:animate-(?!none$)|transition(?!-(?:colors|opacity|none)$)|scroll-smooth$)/
  const applied = Array.from(rules.matchAll(/@apply\s+([^;]+);/g), ([, list = '']) => list)
    .flatMap((list) => list.split(/\s+/))
    .filter((word) => {
      const [utility = '', ...variants] = word.split(':').reverse()
      return moving.test(utility) && !variants.includes('motion')
    })
  expect([...declared.map((pair) => pair.join(': ')), ...applied]).toEqual([])
  // Статика по умолчанию: без этой строки снимок страницы для перехода браузер делает всегда.
  expect(rules).toMatch(/:root \{\s*view-transition-name: none;/)
  // Длительность без свойства перехода не двигает: свойство по умолчанию — `none`, а не `all`.
  expect(rules).toMatch(/\*,\s*::before,\s*::after\s*\{\s*transition-property: none;\s*\}/)
})

// Переход между страницами рисует браузер; длительность и кривую его кадрам дают роли движения.
it('переход между страницами — CSS View Transitions на ролях движения', () => {
  const css = compiler.build([]).replace(/\s+/g, ' ')
  expect(css).toContain('@view-transition { navigation: auto; }')
  const frames = /::view-transition-group\(\*\)[^{]*\{([^}]*)\}/.exec(css)?.[1] ?? ''
  expect(frames).toMatch(/animation-duration: var\(--[\w-]+\);/)
  expect(frames).toMatch(/animation-timing-function: var\(--[\w-]+\);/)
})

// Ширину контейнера берёт один примитив секции. Класс-компонент слоя с ней дал бы её любому
// элементу мимо канона UI: линтер читает разметку, а не правила слоя.
it('правила слоя не берут ширину контейнера', () => {
  const rules = source.replace(THEME_BLOCK, '')
  expect(
    rules.match(
      /(?<![\w-])(?:max-w-[\w-]+|max-(?:width|inline-size)\s*:[^;{}]*|container(?![\w-]))/g,
    ),
  ).toBeNull()
})

// Тему переключает файл токенов: своё условие темы в правиле слоя разошлось бы с выбором
// посетителя и с темами дизайн-системы.
it('правила слоя не знают тему', () => {
  expect(source.match(/prefers-color-scheme|data-theme|light-dark\(|(?<!\w)dark:/g)).toBeNull()
})

// Ловушка формы — для бота: поле на месте и в разметке, но человеку его не видно — тот же блок, что `sr-only`.
it('ловушка формы скрыта от человека — как sr-only', () => {
  const declarations = (utility: string) => rule(utility).replace(/\s+/g, ' ').trim()
  expect(declarations('sr-only')).toContain('position: absolute')
  expect(declarations('honeypot')).toBe(declarations('sr-only'))
})

// Без правила слоя выделение получает `bolder` браузера и становится тяжелее подзаголовка.
it('выделение в строке — насыщенность роли, а не bolder браузера', () => {
  const weights = Array.from(
    compiler.build([]).matchAll(/(?<![\w-])strong\s*\{[^}]*?(?<![\w-])font-weight:\s*([^;}]+)/g),
    ([, value = '']) => value.trim(),
  )
  expect(weights.at(-1)).toMatch(/^var\(--[\w-]+\)$/)
})

// Гарнитуру страницы и кода и толщину линии базовые стили и утилиты Tailwind берут у слоя: без
// его строки их место молча занимают стек и пиксель Tailwind.
it('гарнитуры и толщина линии по умолчанию — роли, а не значения Tailwind', () => {
  const families = Array.from(
    compiler.build([]).matchAll(/(?<![\w-])font-family:\s*([^;]+);/g),
    ([, value = '']) => value,
  )
  expect(families.length).toBeGreaterThan(1)
  expect(families.filter((value) => !/^(?:var\(--[\w-]+|inherit$)/.test(value))).toEqual([])
  expect(fromRole('border', 'border-width')).toBe(true)
})

// Файл токенов в форме ds_build из тем: тема значений — блоком `:root` (при парных — ещё и её
// `color-scheme` под атрибутом), отличия парных от неё — блоком по системе и блоком по атрибуту.
const render = ([base, values]: Theme, pairs: readonly Theme[] = []) => {
  const print = (entries: Iterable<readonly [string, string]>) =>
    Array.from(entries, ([name, value]) => `  ${name}: ${value};`).join('\n')
  const root = new Map(values).set('color-scheme', [base, ...pairs.map(([pair]) => pair)].join(' '))
  return [
    `:root {\n${print(root)}\n}`,
    ...pairs.flatMap(([pair, theirs]) => {
      const own = print([
        ['color-scheme', pair],
        ...[...theirs].filter(
          ([name, value]) => name !== 'color-scheme' && values.get(name) !== value,
        ),
      ])
      return [
        `@media (prefers-color-scheme: ${pair}) {\n:root:not([data-theme="${base}"]) {\n${own}\n}\n}`,
        `:root[data-theme="${pair}"] {\n${own}\n}`,
      ]
    }),
    ...(pairs.length > 0 ? [`:root[data-theme="${base}"] {\n  color-scheme: ${base};\n}`] : []),
  ].join('\n\n')
}

// Проверки не знают значений и тем дизайн-системы: они идут по её файлу и по тем же ролям в других
// формах ds_build — с парной темой в значениях `:root` и с одной темой, под которую стоит поле THEME.
const [ofValues, ...ofPairs] = themesOf(tokens).themes
const DS: Array<{ ds: string; css: string; site: Site }> = [
  { ds: 'файл токенов', css: tokens, site: THEME },
  ...ofPairs.map((pair) => ({
    ds: `файл токенов, тема значений — ${pair[0]}`,
    css: render(pair, [ofValues]),
    site: THEME,
  })),
  {
    ds: 'файл токенов с одной темой',
    css: render(ofValues),
    site: { default: ofValues[0], switcher: false },
  },
]
describe.each(DS)('$ds', ({ css, site }) => {
  const { themes, faults } = themesOf(css)
  const names = themes.map(([name]) => name)

  // Замена файла токенов дизайн-системой с другим набором ролей: тест называет каждую
  // переменную, которой в файле нет, — её строка слоя сопоставления ведёт в пустоту.
  it('каждая роль, на которую ссылается слой сопоставления, объявлена в файле токенов', () => {
    const own = declared(layer)
    const roles = declared(css)
    expect([...referenced(layer)].filter((name) => !own.has(name) && !roles.has(name))).toEqual([])
  })

  it('блоки тем: система и атрибут — одни значения, выбор несёт color-scheme темы, чужих блоков нет', () => {
    expect(faults).toEqual([])
  })

  // Подмножество, а не равенство: сайту одной темы годится ДС с двумя (правило R-COV-010 strategy).
  it('темы поля THEME есть у файла токенов', () => {
    expect(themesOfSite(site).filter((theme) => !names.includes(theme))).toEqual([])
  })

  it('пары контраста ролей не ниже порогов в каждой теме', () => {
    expect(contrastFaults(themes, PAIRS, roleOf)).toEqual([])
  })
})

describe('проверки файла токенов называют нарушение', () => {
  const INK = '--ink: #eeeeee; --paper: #111111;'
  const TWO = [
    ':root { color-scheme: light dark; --ink: #222222; --paper: #ffffff; }',
    `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { color-scheme: dark; ${INK} } }`,
    `:root[data-theme="dark"] { color-scheme: dark; ${INK} }`,
    ':root[data-theme="light"] { color-scheme: light; }',
  ]
  const [root = '', bySystem = '', byAttribute = '', ofBase = ''] = TWO
  const ONE = root.replace('light dark', 'light')

  it('согласованный файл — без замечаний, темы — из color-scheme блока :root', () => {
    expect(themesOf(TWO.join('\n')).faults).toEqual([])
    expect(themesOf(TWO.join('\n')).themes.map(([name]) => name)).toEqual(['light', 'dark'])
    expect(themesOf(ONE).themes.map(([name]) => name)).toEqual(['light'])
  })

  it('блок темы по атрибуту расходится с блоком по системе или один из них потерян', () => {
    const drifted = byAttribute.replace('#eeeeee', '#777777')
    expect(themesOf([root, bySystem, drifted, ofBase].join('\n')).faults).toEqual([
      'тема dark, --ink: по атрибуту #777777, по системе #eeeeee',
    ])
    expect(themesOf([root, bySystem, ofBase].join('\n')).faults).toEqual([
      'тема dark: нет блока по атрибуту или по системе',
    ])
  })

  it('выбор темы атрибутом без её color-scheme: у парной темы и у темы значений', () => {
    const schemeless = [bySystem, byAttribute].map((block) =>
      block.replace('color-scheme: dark; ', ''),
    )
    expect(themesOf([root, ...schemeless, ofBase].join('\n')).faults).toEqual([
      'блок :root[data-theme="dark"] не объявляет color-scheme dark',
    ])
    expect(themesOf([root, bySystem, byAttribute].join('\n')).faults).toEqual([
      'блок :root[data-theme="light"] не объявляет color-scheme light',
    ])
    expect(themesOf([ONE, ofBase].join('\n')).faults).toEqual([])
  })

  it('блок темы, которой нет в color-scheme блока :root', () => {
    expect(themesOf([ONE, bySystem, byAttribute].join('\n')).faults).toEqual([
      'блок темы вне color-scheme :root: (prefers-color-scheme: dark) :root:not([data-theme="light"])',
      'блок темы вне color-scheme :root: :root[data-theme="dark"]',
    ])
  })

  it('кнопка выбора и тема по системе при одной теме файла; тема, которой у файла нет', () => {
    const names = themesOf(ONE).themes.map(([name]) => name)
    const lacking = (site: Site) => themesOfSite(site).filter((theme) => !names.includes(theme))
    expect(lacking({ default: 'system', switcher: false })).toEqual(['dark'])
    expect(lacking({ default: 'light', switcher: true })).toEqual(['dark'])
    expect(lacking({ default: 'dark', switcher: false })).toEqual(['dark'])
    expect(lacking({ default: 'light', switcher: false })).toEqual([])
  })

  it('пара ниже порога — в той теме, где она ниже; значение не в #rrggbb', () => {
    const pair = [['--ink', '--paper', 4.5]] as const
    const dim = themesOf(TWO.join('\n').replaceAll('#eeeeee', '#555555')).themes
    expect(contrastFaults(dim, pair)).toEqual(['dark: --ink на --paper — 2.53:1, порог 4.5:1'])
    const translucent = themesOf(ONE.replace('#222222', 'rgb(0 0 0 / 0.5)')).themes
    expect(contrastFaults(translucent, pair)).toEqual([
      'light: --ink на --paper — не #rrggbb (rgb(0 0 0 / 0.5) на #ffffff)',
    ])
  })
})

// Разметка сайта — как её видит линтер (тот же AST): слова строк в атрибутах `class` и
// `class:list` и классы своего <style> у каждого .astro.
type Node = { type: string; [key: string]: unknown }
const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && typeof (value as Node).type === 'string'
const read = (node: unknown, ...path: string[]) =>
  path.reduce<unknown>(
    (value, key) =>
      typeof value === 'object' ? (value as Partial<Node> | null)?.[key] : undefined,
    node,
  )
const childrenOf = (node: Node, field: string) =>
  ([] as unknown[]).concat(node[field]).filter(isNode)
function* nodesOf(node: Node, parent?: Node): Generator<[node: Node, parent: Node | undefined]> {
  yield [node, parent]
  for (const field of Object.keys(node)) {
    if (field !== 'parent') for (const child of childrenOf(node, field)) yield* nodesOf(child, node)
  }
}
const isClass = (node: Node) =>
  node.type === 'JSXAttribute' &&
  (read(node, 'name', 'namespace', 'name') ?? read(node, 'name', 'name')) === 'class'

// Строка класса — литерал на месте значения: поля узла, откуда значение доходит до атрибута.
// Условие (проверка `? :`, левая часть `&&`, значение ключа объекта) классом не становится.
const VALUE: Record<string, readonly string[]> = {
  JSXAttribute: ['value'],
  JSXExpressionContainer: ['expression'],
  TemplateLiteral: ['quasis', 'expressions'],
  ArrayExpression: ['elements'],
  ObjectExpression: ['properties'],
  Property: ['key'],
  ConditionalExpression: ['consequent', 'alternate'],
  LogicalExpression: ['right'],
}
function* classTexts(node: Node, isKey = false): Generator<unknown> {
  if (node.type === 'Literal') yield node.value
  if (node.type === 'TemplateElement') yield read(node, 'value', 'raw')
  if (node.type === 'Identifier' && isKey) yield node.name
  const own = node.type === 'Property' && node.computed === true ? [] : (VALUE[node.type] ?? [])
  for (const field of own) {
    for (const child of childrenOf(node, field)) yield* classTexts(child, node.type === 'Property')
  }
}

const selectors = (css: string) => new Set(css.match(/\.[a-z_][\w-]*/gi))
function classesOf(code: string) {
  const classes = new Set<string>()
  const styles: unknown[] = []
  const { ast } = parseForESLint(code, { parser: tseslint.parser })
  for (const [node, parent] of nodesOf(ast as unknown as Node)) {
    const inStyle = read(parent, 'openingElement', 'name', 'name') === 'style'
    if (node.type === 'AstroRawText' && inStyle) styles.push(node.value)
    if (!isClass(node)) continue
    for (const text of classTexts(node)) {
      if (typeof text === 'string') for (const word of text.split(/\s+/)) classes.add(word)
    }
  }
  return { classes: [...classes].filter(Boolean), own: selectors(styles.join('\n')) }
}

const SRC = fileURLToPath(new URL('../..', import.meta.url))
const components = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
  .filter((path) => path.endsWith('.astro'))
  .map((path) => ({ path, ...classesOf(readFileSync(join(SRC, path), 'utf8')) }))

// Маркер — класс без CSS по устройству Tailwind: его читают варианты `group-*:` и `peer-*:`.
const MARKER = /^(?:group|peer)(?:\/[\w-]+)?$/
// Классы без CSS: не утилита слоя, не класс-компонент слоя и не класс своего <style>.
async function withoutCss(files: ReadonlyArray<ReturnType<typeof classesOf> & { path: string }>) {
  // Свежий компилятор: он копит классы, и «класс дал CSS» видно только при первом вызове.
  const fresh = await compileLayer()
  let css = fresh.build([])
  const ofLayer = selectors(css)
  const given = new Map<string, boolean>()
  const gives = (name: string) => {
    if (!given.has(name)) {
      const next = fresh.build([name])
      given.set(name, next !== css)
      css = next
    }
    return given.get(name) === true
  }
  return files.flatMap(({ path, classes, own }) =>
    classes
      .filter((name) => !MARKER.test(name) && !gives(name))
      .filter((name) => !ofLayer.has(`.${name}`) && !own.has(`.${name}`))
      .map((name) => `${path}: ${name}`),
  )
}

// Строка слоя, которую берёт только разметка, удалена или класс написан мимо слоя — у класса нет
// ни байта CSS, и сборка об этом молчит.
it('каждый класс разметки даёт CSS: утилита слоя, класс-компонент слоя или класс своего <style>', async () => {
  expect(components.length).toBeGreaterThan(0)
  expect(await withoutCss(components)).toEqual([])
})

it('слово класса — литерал на месте значения: условие и маркер — не класс, класс без CSS назван', async () => {
  const probe = classesOf(`---
const { class: className, locale, wide } = Astro.props
---

<p
  class:list={[
    'mt-md',
    locale === 'en' && 'text-secondary',
    { hidden: wide, 'text-lead': locale !== 'ru' },
    wide ? \`gap-lg \${className}\` : 'gap-md',
    className,
  ]}
>
  <a class="group peer/menu mt-4 text-secondry" href="/">…</a>
</p>
`)
  expect(probe.classes.toSorted()).toEqual(
    [
      ...['mt-md', 'text-secondary', 'hidden', 'text-lead', 'gap-lg', 'gap-md'],
      ...['group', 'peer/menu', 'mt-4', 'text-secondry'],
    ].toSorted(),
  )
  expect(await withoutCss([{ path: 'probe.astro', ...probe }])).toEqual([
    'probe.astro: mt-4',
    'probe.astro: text-secondry',
  ])
})
