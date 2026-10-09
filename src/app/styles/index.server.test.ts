import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compile } from 'tailwindcss'
import { THEME } from '@/shared/config'

// Токен-слой компилируется, как на сборке, и классы проверяются выводом компилятора, а не CSS
// сборки: сборка печатает только использованные утилиты, и вернувшаяся палитра в ней не видна,
// пока её класс не попал в разметку.
const entry = fileURLToPath(new URL('./index.css', import.meta.url))
const layer = await readFile(entry, 'utf8')
const tokens = await readFile(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8')
const require = createRequire(import.meta.url)
const compiler = await compile(layer, {
  base: dirname(entry),
  loadStylesheet: async (id, base) => {
    const path = id === 'tailwindcss' ? require.resolve('tailwindcss/index.css') : resolve(base, id)
    return { path, base: dirname(path), content: await readFile(path, 'utf8') }
  },
})
// Компилятор копит классы всех вызовов: «класс не дал CSS» — вывод равен выводу до него.
const adds = (classes: string[]) => compiler.build([]) !== compiler.build(classes)
// Объявления, которые утилита даёт своему классу.
const rule = (utility: string) =>
  new RegExp(`\\.${utility}\\s*\\{([^}]*)\\}`).exec(compiler.build([utility]))?.[1] ?? ''

const declared = (source: string) => new Set(source.match(/--[\w-]+(?=\s*:)/g))
const referenced = (source: string) =>
  new Set(Array.from(source.matchAll(/var\((--[\w-]+)/g), ([, name = '']) => name))
// Значения объявлений color-scheme; `prefers-color-scheme` медиа-условия — не объявление.
const colorSchemes = (source: string) =>
  Array.from(source.matchAll(/(?<![\w-])color-scheme:\s*([^;{}]+)/g), ([, value = '']) => value)

it('тема Tailwind по умолчанию выключена: её классы не дают CSS, утилита роли — даёт', () => {
  const closed = [
    ...['text-zinc-500', 'bg-red-600', 'text-white', 'border-black', 'font-mono'],
    ...['text-xl', 'font-semibold', 'tracking-tight', 'leading-tight'],
    ...['mt-4', 'px-6', 'gap-x-8', 'w-40', 'size-4', '-mr-2'],
    ...['rounded-md', 'max-w-prose', 'sm:hidden', 'lg:hidden', 'shadow-md'],
  ]
  expect(closed.filter((utility) => adds([utility]))).toEqual([])
  expect(rule('text-secondary')).toContain('color: var(--color-text-secondary)')
})

it('утилита роли — только своего свойства: роль фона не красит текст', () => {
  expect(adds(['text-canvas', 'bg-secondary', 'border-canvas'])).toBe(false)
  expect(compiler.build(['bg-canvas'])).toContain('background-color: var(--color-bg-canvas)')
})

it('роль текста — одна утилита: кегль, интерлиньяж, насыщенность и трекинг', () => {
  const roles = Array.from(
    layer.matchAll(/--text-((?!color-|decoration-|underline-)[a-z]+(?:-[a-z]+)*):/g),
    ([, role = '']) => role,
  )
  const parts = ['font-size', 'line-height', 'font-weight', 'letter-spacing']
  expect(roles).toContain('body')
  expect(
    roles.filter((role) => !parts.every((part) => rule(`text-${role}`).includes(`${part}: `))),
  ).toEqual([])
  expect(rule('text-lead')).toContain('font-size: var(--type-lead-size)')
})

it('отступ — шаг шкалы и ритм файла токенов', () => {
  expect(rule('mt-md')).toContain('margin-top: var(--space-md)')
  expect(rule('px-page-x')).toContain('padding-inline: var(--rhythm-page-x)')
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

// Замена файла токенов дизайн-системой с другим набором ролей: тест называет каждую переменную,
// которой в файле нет, — её строка слоя сопоставления ведёт в пустоту.
it('каждая роль, на которую ссылается слой сопоставления, объявлена в файле токенов', () => {
  const own = declared(layer)
  const roles = declared(tokens)
  expect([...referenced(layer)].filter((name) => !own.has(name) && !roles.has(name))).toEqual([])
})

it('темы поля THEME — ровно темы файла токенов', () => {
  const [ofRoot = ''] = colorSchemes(tokens)
  const ofSite = THEME.default === 'system' || THEME.switcher ? ['dark', 'light'] : [THEME.default]
  expect(ofSite).toEqual(ofRoot.split(' ').sort())
})

it('color-scheme объявляет только файл токенов', () => {
  expect(colorSchemes(compiler.build([]))).toEqual(colorSchemes(tokens))
})
