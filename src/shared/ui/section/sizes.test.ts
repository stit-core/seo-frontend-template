import { slotSizes } from './sizes'

// Слой сопоставления и файл токенов — в форме настоящих: строка ключа контейнера ссылается на роль,
// роль несёт значение.
const LAYER = `@theme inline {
  --spacing-page-x: var(--rhythm-page-x);
  --max-width-measure: var(--size-measure);
  --max-width-container: var(--size-container);
  --max-width-container-wide: var(--size-container-wide);
}`
const tokens = (roles: Record<string, string>) =>
  `:root {\n${Object.entries(roles)
    .map(([role, value]) => `  ${role}: ${value};`)
    .join('\n')}\n}`
const ROLES = {
  '--rhythm-page-x': '1.5rem',
  '--size-measure': '38rem',
  '--size-container': '48rem',
  '--size-container-wide': '72rem',
}

describe('slotSizes', () => {
  it('длины — значения ролей файла токенов: другие значения дают другие sizes', () => {
    expect(slotSizes(LAYER, tokens(ROLES))).toEqual({
      reading: '(min-width: 38rem) calc(38rem - 3rem), calc(100vw - 3rem)',
      page: '(min-width: 48rem) calc(48rem - 3rem), calc(100vw - 3rem)',
      wide: '(min-width: 72rem) calc(72rem - 3rem), calc(100vw - 3rem)',
      full: '100vw',
    })
    const other = {
      '--rhythm-page-x': '2rem',
      '--size-measure': '44rem',
      '--size-container': '56rem',
      '--size-container-wide': '80rem',
    }
    expect(slotSizes(LAYER, tokens(other))).toEqual({
      reading: '(min-width: 44rem) calc(44rem - 4rem), calc(100vw - 4rem)',
      page: '(min-width: 56rem) calc(56rem - 4rem), calc(100vw - 4rem)',
      wide: '(min-width: 80rem) calc(80rem - 4rem), calc(100vw - 4rem)',
      full: '100vw',
    })
  })

  it('поля страницы в px вычитаются с двух сторон', () => {
    const { reading } = slotSizes(LAYER, tokens({ ...ROLES, '--rhythm-page-x': '24px' }))
    expect(reading).toBe('(min-width: 38rem) calc(38rem - 48px), calc(100vw - 48px)')
  })

  // У ДС с другими именами ролей меняются только правые части строк слоя.
  it('роль — та, на которую ссылается строка слоя', () => {
    const layer = LAYER.replace('var(--size-measure)', 'var(--layout-reading)')
    const { reading } = slotSizes(layer, tokens({ ...ROLES, '--layout-reading': '40rem' }))
    expect(reading).toBe('(min-width: 40rem) calc(40rem - 3rem), calc(100vw - 3rem)')
  })

  it('роль узнаётся по имени целиком', () => {
    const decoys = { '--size-measure-wide': '50rem', '--x--size-measure': '1rem', ...ROLES }
    expect(slotSizes(LAYER, tokens(decoys)).reading).toBe(
      '(min-width: 38rem) calc(38rem - 3rem), calc(100vw - 3rem)',
    )
  })

  it('роли нет в файле токенов — отказ называет роль и файл', () => {
    const rest = Object.entries(ROLES).filter(([role]) => role !== '--size-container')
    expect(() => slotSizes(LAYER, tokens(Object.fromEntries(rest)))).toThrow(
      'роли --size-container нет в файле токенов src/app/styles/tokens.css',
    )
  })

  it.each(['clamp(30rem, 50vw, 40rem)', 'var(--size-wide)', '38em', '60%', ''])(
    'роль — не длина в rem или px («%s»): отказ называет роль, значение и файл',
    (value) => {
      expect(() => slotSizes(LAYER, tokens({ ...ROLES, '--size-measure': value }))).toThrow(
        `роль --size-measure в файле токенов src/app/styles/tokens.css — «${value}», а не длина`,
      )
    },
  )

  it('у ключа контейнера нет роли в слое — отказ называет ключ и файл', () => {
    const layer = LAYER.replace('--spacing-page-x: var(--rhythm-page-x);', '')
    expect(() => slotSizes(layer, tokens(ROLES))).toThrow(
      'у ключа --spacing-page-x нет роли в слое src/app/styles/index.css',
    )
  })
})
