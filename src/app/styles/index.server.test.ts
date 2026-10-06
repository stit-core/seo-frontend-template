import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compile } from 'tailwindcss'

// Токен-слой компилируется, как на сборке, и классы проверяются выводом компилятора, а не CSS
// сборки: сборка печатает только использованные утилиты, и вернувшаяся палитра в ней не видна,
// пока её класс не попал в разметку.
const tokens = fileURLToPath(new URL('./index.css', import.meta.url))
const require = createRequire(import.meta.url)
const compiler = await compile(await readFile(tokens, 'utf8'), {
  base: dirname(tokens),
  loadStylesheet: async (id, base) => {
    const path = id === 'tailwindcss' ? require.resolve('tailwindcss/index.css') : resolve(base, id)
    return { path, base: dirname(path), content: await readFile(path, 'utf8') }
  },
})

it('палитра Tailwind по умолчанию выключена: её классы не дают CSS, семантические — дают', () => {
  const css = compiler.build([])
  expect(compiler.build(['text-zinc-500', 'bg-red-600', 'text-white', 'border-black'])).toBe(css)
  expect(compiler.build(['text-muted'])).toContain('color: var(--scheme-muted)')
})
