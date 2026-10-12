import { readFileSync } from 'node:fs'
import { FONTS, type FontFile, fontFamilies, fontStacks, fontVariable } from './fonts'

const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8')

// Семейству нужен файл, если первое имя стека не родовое и не системное — порт нормы ds_build
// strategy (GENERIC_FONTS и SYSTEM_FONTS).
const BUILT_IN = new Set([
  ...['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'emoji', 'math'],
  ...['fangsong', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', '-apple-system'],
  ...['blinkmacsystemfont', 'segoe ui', 'helvetica neue', 'helvetica', 'arial', 'georgia'],
  ...['times new roman', 'times', 'courier new', 'courier', 'verdana', 'tahoma', 'trebuchet ms'],
  ...['menlo', 'monaco', 'consolas'],
])

// Объявления CSS без комментариев; у повтора берётся первое — блок `:root` файла токенов.
function declarations(css: string) {
  const found = new Map<string, string>()
  for (const [, name = '', value = ''] of css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)) {
    if (!found.has(name)) found.set(name, value.trim())
  }
  return found
}

const covers = (weight: FontFile['weight'], wanted: number) => {
  const [from = 0, to = from] = String(weight).split(' ').map(Number)
  return from <= wanted && wanted <= to
}

// Согласие «роль → переменная семейства → строки списка». Роли — гарнитуры, которые слой
// сопоставления берёт у файла токенов: роли текста (`--typeface-<роль>` с её насыщенностью) и
// гарнитуры страницы и кода по умолчанию (насыщенность обычная). Значений ДС и шрифтов проекта
// проверка не знает.
function fontFaults(layer: string, tokens: string, fonts: readonly FontFile[]) {
  const mapped = declarations(layer)
  const values = declarations(tokens)
  const refOf = (key: string) => /^var\((--[\w-]+)\)$/.exec(mapped.get(key) ?? '')?.[1]
  const roles = [...mapped.keys()].flatMap((key) => {
    const role = /^--typeface-(.+)$/.exec(key)?.[1]
    const name = refOf(key)
    if (
      name === undefined ||
      (role === undefined && !/^--default-(mono-)?font-family$/.test(key))
    ) {
      return []
    }
    const weight =
      role === undefined ? 400 : Number(values.get(refOf(`--text-${role}--font-weight`) ?? ''))
    return [{ name, stack: values.get(name) ?? '', weight }]
  })
  const faults: string[] = []
  const named = new Set<FontFile>()
  for (const { name, stack, weight } of roles) {
    const [[variable, names] = [undefined, stack.split(',')]] = fontStacks(stack)
    const family = names[0]?.trim().replace(/^(["'])(.*)\1$/, '$2') ?? ''
    if (variable === undefined) {
      if (!BUILT_IN.has(family.toLowerCase())) {
        faults.push(
          `${name}: гарнитура ${family} литералом — семейству с файлом нужна ссылка var(${fontVariable(family)}, …) файла токенов (strategy 0.2.1) и строки списка шрифтов`,
        )
      }
      continue
    }
    if (variable !== fontVariable(family)) {
      faults.push(
        `${name}: ${variable} — не переменная своего семейства ${family}: у него ${fontVariable(family)}`,
      )
    }
    const files = fonts.filter((font) => font.family === family)
    for (const font of files) if (covers(font.weight, weight)) named.add(font)
    if (files.length === 0) {
      faults.push(`${name}: семейству ${family} нужен файл — в списке шрифтов его нет`)
    } else if (!files.some((font) => font.style === 'normal' && covers(font.weight, weight))) {
      faults.push(`${name}: у ${family} нет файла насыщенности ${weight} — браузер нарисует её сам`)
    }
  }
  for (const font of fonts) {
    if (!named.has(font)) {
      faults.push(`${font.file} (${font.family} ${font.weight}): файл не называет ни одна роль`)
    }
    if (values.has(fontVariable(font.family))) {
      faults.push(
        `${font.file}: переменная семейства ${fontVariable(font.family)} занята переменной файла токенов`,
      )
    }
  }
  return faults
}

it('роли файла токенов и список шрифтов согласны: роль → переменная семейства → его файлы', () => {
  expect(fontFaults(read('./index.css'), read('./tokens.css'), FONTS)).toEqual([])
})

describe('проверка согласия называет нарушение', () => {
  const LAYER = `@theme inline {
    --default-font-family: var(--font-text);
    --text-body--font-weight: var(--type-body-weight);
    --typeface-body: var(--type-body-family);
    --text-title--font-weight: var(--type-title-weight);
    --typeface-title: var(--type-title-family);
  }`
  const GOLOS = 'var(--font-golos-text, "Golos Text", Arial, sans-serif)'
  const ONEST = 'var(--font-onest, Onest, Arial, sans-serif)'
  const tokens = ({ body = GOLOS, title = ONEST } = {}) =>
    `:root { --font-text: ${body}; --type-body-family: ${body}; --type-body-weight: 400; --type-title-family: ${title}; --type-title-weight: 600; }`
  const golos: FontFile[] = [
    { family: 'Golos Text', weight: '400 900', style: 'normal', file: 'golos-latin.woff2' },
    { family: 'Golos Text', weight: '400 900', style: 'normal', file: 'golos-cyrillic.woff2' },
  ]
  const onest: FontFile = { family: 'Onest', weight: 600, style: 'normal', file: 'onest-600.woff2' }

  it('согласованные роли и список — без замечаний; системный стек литералом файла не ждёт', () => {
    expect(fontFaults(LAYER, tokens(), [...golos, onest])).toEqual([])
    const system = 'ui-sans-serif, system-ui, sans-serif'
    expect(fontFaults(LAYER, tokens({ body: system, title: system }), [])).toEqual([])
  })

  it('роль называет переменную не своего семейства', () => {
    const foreign = 'var(--font-inter, "Golos Text", Arial, sans-serif)'
    expect(fontFaults(LAYER, tokens({ body: foreign }), [...golos, onest])).toEqual([
      '--font-text: --font-inter — не переменная своего семейства Golos Text: у него --font-golos-text',
      '--type-body-family: --font-inter — не переменная своего семейства Golos Text: у него --font-golos-text',
    ])
  })

  it('файл, которого не называет ни одна роль: чужое семейство и насыщенность без роли', () => {
    const stray: FontFile[] = [
      { family: 'Literata', weight: 400, style: 'normal', file: 'literata.woff2' },
      { ...onest, weight: 800, file: 'onest-800.woff2' },
    ]
    expect(fontFaults(LAYER, tokens(), [...golos, onest, ...stray])).toEqual([
      'literata.woff2 (Literata 400): файл не называет ни одна роль',
      'onest-800.woff2 (Onest 800): файл не называет ни одна роль',
    ])
  })

  it('семейство роли без файлов и насыщенность роли без своего файла', () => {
    expect(fontFaults(LAYER, tokens(), golos)).toEqual([
      '--type-title-family: семейству Onest нужен файл — в списке шрифтов его нет',
    ])
    const light = { ...onest, weight: 300, file: 'onest-300.woff2' }
    expect(fontFaults(LAYER, tokens(), [...golos, light])).toEqual([
      '--type-title-family: у Onest нет файла насыщенности 600 — браузер нарисует её сам',
      'onest-300.woff2 (Onest 300): файл не называет ни одна роль',
    ])
  })

  it('гарнитура с файлом литералом: файл токенов прежней формы или шрифт без файла', () => {
    expect(
      fontFaults(LAYER, tokens({ body: 'Inter, ui-sans-serif, sans-serif' }), [onest]),
    ).toEqual([
      '--font-text: гарнитура Inter литералом — семейству с файлом нужна ссылка var(--font-inter, …) файла токенов (strategy 0.2.1) и строки списка шрифтов',
      '--type-body-family: гарнитура Inter литералом — семейству с файлом нужна ссылка var(--font-inter, …) файла токенов (strategy 0.2.1) и строки списка шрифтов',
    ])
  })

  it('переменная семейства списка занята переменной файла токенов', () => {
    const taken: FontFile = { family: 'Text', weight: 400, style: 'normal', file: 'text.woff2' }
    expect(fontFaults(LAYER, tokens(), [...golos, onest, taken])).toEqual([
      'text.woff2 (Text 400): файл не называет ни одна роль',
      'text.woff2: переменная семейства --font-text занята переменной файла токенов',
    ])
  })
})

describe('список шрифтов', () => {
  it('переменная семейства — ключ производного CSS strategy', () => {
    expect(fontVariable('Golos Text')).toBe('--font-golos-text')
    expect(fontVariable('M+ 1p')).toBe('--font-m-1p')
    expect(fontVariable('PT-Sans')).toBe(fontVariable('PT Sans'))
  })

  it('семейство — варианты Fonts API из его строк и preload начертаний первого экрана', () => {
    const rows: FontFile[] = [
      {
        family: 'Golos Text',
        weight: '400 900',
        style: 'normal',
        file: 'a.woff2',
        unicodeRange: 'U+0000-00FF',
        preload: true,
      },
      { family: 'Onest', weight: 600, style: 'normal', file: 'b.woff2' },
      {
        family: 'Golos Text',
        weight: '400 900',
        style: 'normal',
        file: 'c.woff2',
        unicodeRange: 'U+0400-045F',
        preload: true,
      },
    ]
    expect(fontFamilies(rows)).toEqual([
      {
        family: 'Golos Text',
        variable: '--font-golos-text',
        variants: [
          { src: ['a.woff2'], weight: '400 900', style: 'normal', unicodeRange: ['U+0000-00FF'] },
          { src: ['c.woff2'], weight: '400 900', style: 'normal', unicodeRange: ['U+0400-045F'] },
        ],
        preload: [
          { weight: '400 900', style: 'normal' },
          { weight: '400 900', style: 'normal' },
        ],
      },
      {
        family: 'Onest',
        variable: '--font-onest',
        variants: [{ src: ['b.woff2'], weight: 600, style: 'normal' }],
        preload: [],
      },
    ])
  })

  it('стек переменной семейства в файле токенов — имена без кавычек', () => {
    const css =
      ':root { --a: var(--font-golos-text, "Golos Text", Arial, sans-serif); --b: var(--font-onest, Onest, sans-serif); }'
    expect(fontStacks(css)).toEqual(
      new Map([
        ['--font-golos-text', ['Golos Text', 'Arial', 'sans-serif']],
        ['--font-onest', ['Onest', 'sans-serif']],
      ]),
    )
  })
})
