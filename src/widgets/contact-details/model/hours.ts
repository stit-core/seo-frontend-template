import { type FactValue, fail } from '@/shared/strategy'

// Часть строки часов работы: текст как есть или время факта — для `<time>`.
export type HoursPart = string | { time: string }

// Строки контактов, которые называют часы работы фактов секции (`machine` opening-hours): у такой строки — части текста
// и время факта, у прочих — undefined. Факт часов есть, а строки со всем его временем нет — ошибка сборки с ключом:
// видимые часы разошлись бы с машинными, которые размечает организация.
export function hoursOf(
  info: readonly string[],
  facts: readonly FactValue[],
  key: string,
): Array<HoursPart[] | undefined> {
  const lines: Array<HoursPart[] | undefined> = info.map(() => undefined)
  for (const { id, machine } of facts) {
    if (machine?.type !== 'opening-hours') continue
    const times = [...new Set(machine.hours.flatMap(({ opens, closes }) => [opens, closes]))]
    const index = info.findIndex((line) => times.every((time) => line.includes(time)))
    const line =
      info[index] ??
      fail(key, `часы факта ${id} (${times.join(', ')}) — нет строки контактов с ними`)
    lines[index] = times
      .reduce<HoursPart[]>(
        (parts, time) =>
          parts.flatMap((part) =>
            typeof part === 'string'
              ? part.split(time).flatMap((piece, at) => (at === 0 ? [piece] : [{ time }, piece]))
              : [part],
          ),
        [line],
      )
      .filter((part) => part !== '')
  }
  return lines
}
