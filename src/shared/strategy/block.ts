import { z } from 'zod'
import { fail } from './contract'
import type { FactValue, StrategyPage } from './page'

// Значения слотов блока — как их отдаёт чтение страницы: текст copy deck, действие плана с адресом цели, факт.
export const text = z.string()
export const action = z.strictObject({ href: z.string() })
export const fact = z.custom<FactValue>(
  (value) => typeof value === 'object' && value !== null && 'id' in value && 'text' in value,
)

// Элемент, который план заполняет не раз (пункты меню, абзацы раздела): значения по порядку плана; один — тоже список.
export const list = <T extends z.ZodType>(value: T) =>
  z.preprocess((given) => [given].flat(), z.array(value))

// Повторяемый набор каталога (карточки, пункты): экземпляры по порядку плана, в каждом — элементы набора.
export const group = <const S extends Record<string, z.ZodType>>(elements: S) =>
  z.array(z.strictObject(elements))

// Блок каталога strategy — `widgets/<id>`: id и варианты каталога, которые он умеет, слоты — элементы его анатомии с
// видом значения. Пропсы блока — id секции плана (подпись секции и якорь), вариант и слоты; соответствие каталогу и
// планам держит тест контракта (src/pages/_tests/blocks.astro.test.ts).
export function defineBlock<
  const V extends string,
  const S extends Record<string, z.ZodType>,
>(block: { id: string; variants: readonly [V, ...V[]]; slots: S }) {
  const schema = z.strictObject({ id: z.string(), variant: z.enum(block.variants), ...block.slots })
  return {
    ...block,
    // Пропсы секции страницы: другой блок, вариант не из блока, слот вне его анатомии или без значения — ошибка
    // сборки с ключом секции.
    props(page: StrategyPage, section: string): z.output<typeof schema> {
      const key = `${page.id}/${section}`
      const found =
        page.sections.find((candidate) => candidate.id === section) ??
        fail(key, 'секции нет в плане')
      if (found.block !== block.id) fail(key, `в плане блок ${found.block}, а не ${block.id}`)
      const result = schema.safeParse({
        id: found.id,
        variant: found.variant,
        ...found.slots,
        ...found.groups,
      })
      if (!result.success) fail(key, `блок ${block.id}: ${z.prettifyError(result.error)}`)
      return result.data
    },
  }
}

export type BlockProps<B extends { props: (page: StrategyPage, section: string) => unknown }> =
  ReturnType<B['props']>
