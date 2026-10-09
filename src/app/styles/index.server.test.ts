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

const declared = (source: string) => new Set(source.match(/--[\w-]+(?=\s*:)/g))
const referenced = (source: string) =>
  new Set(Array.from(source.matchAll(/var\((--[\w-]+)/g), ([, name = '']) => name))
// Значения объявлений color-scheme; `prefers-color-scheme` медиа-условия — не объявление.
const colorSchemes = (source: string) =>
  Array.from(source.matchAll(/(?<![\w-])color-scheme:\s*([^;{}]+)/g), ([, value = '']) => value)

it('палитра и гарнитуры Tailwind по умолчанию выключены: их классы не дают CSS, утилита роли — даёт', () => {
  const closed = ['text-zinc-500', 'bg-red-600', 'text-white', 'border-black', 'font-mono']
  expect(adds(closed)).toBe(false)
  expect(compiler.build(['text-secondary'])).toContain('color: var(--color-text-secondary)')
})

it('утилита роли — только своего свойства: роль фона не красит текст', () => {
  expect(adds(['text-canvas', 'bg-secondary', 'border-canvas'])).toBe(false)
  expect(compiler.build(['bg-canvas'])).toContain('background-color: var(--color-bg-canvas)')
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
