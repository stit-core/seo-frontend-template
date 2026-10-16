import { type FactValue, fail } from '@/shared/strategy'

// Часть строки часов работы: текст как есть или время факта — значение `<time>` и его запись в строке.
export type HoursPart = string | { time: string; text: string }

// Время в тексте — по смыслу, а не буквами: «10:00», «10.00», «9:30», у ровного часа — и без минут («10–19»).
function timeIn(time: string): RegExp {
  const [hours = '', minutes = ''] = time.split(':')
  const hour = String(Number(hours))
  const h = hour.length === 1 ? `0?${hour}` : hour
  const m = minutes === '00' ? '(?:[:.]00)?' : `[:.]${minutes}`
  return new RegExp(`(?<![\\d:.])${h}${m}(?!\\d|[:.]\\d)`, 'g')
}

// Как близко строка называет ряд: от времени открытия до ближайшего за ним времени закрытия; пары нет — undefined.
function gapOf(line: string, opens: string, closes: string): number | undefined {
  const ends = [...line.matchAll(timeIn(opens))].map((match) => match.index + match[0].length)
  const starts = [...line.matchAll(timeIn(closes))].map((match) => match.index)
  const gaps = ends.flatMap((end) => starts.flatMap((start) => (start < end ? [] : [start - end])))
  return gaps.length > 0 ? Math.min(...gaps) : undefined
}

// Строки контактов, которые называют часы работы фактов секции (`machine` opening-hours): у такой строки — части текста
// и время факта, у прочих — undefined. Ряд факта (дни, открытие, закрытие) называет строка, где за его открытием ближе
// всего идёт закрытие: ряды — одной строкой или каждый своей, время — с минутами или без («10–19», «с 10 до 19»), а
// номер дома и офиса в адресе часами не становится. Ряда без строки нет — ошибка сборки с ключом: видимые часы разошлись
// бы с машинными, которые размечает организация.
export function hoursOf(
  info: readonly string[],
  facts: readonly FactValue[],
  key: string,
): Array<HoursPart[] | undefined> {
  const lines = info.map((text) => ({ text, times: new Set<string>() }))
  for (const { id, machine } of facts) {
    if (machine?.type !== 'opening-hours') continue
    for (const { days, opens, closes } of machine.hours) {
      const nearest = lines
        .flatMap((line) => {
          const gap = gapOf(line.text, opens, closes)
          return gap === undefined ? [] : [{ gap, line }]
        })
        .sort((a, b) => a.gap - b.gap)[0]
      if (nearest === undefined) {
        fail(
          key,
          `часы факта ${id} (${days.join(', ')} ${opens}–${closes}) — нет строки контактов с ними`,
        )
      }
      nearest.line.times.add(opens).add(closes)
    }
  }
  return lines.map(({ text, times }) => {
    if (times.size === 0) return undefined
    const found = [...times]
      .flatMap((time) =>
        [...text.matchAll(timeIn(time))].map((match) => ({
          time,
          start: match.index,
          end: match.index + match[0].length,
        })),
      )
      .sort((a, b) => a.start - b.start)
    const parts: HoursPart[] = []
    let at = 0
    for (const { time, start, end } of found) {
      parts.push(text.slice(at, start), { time, text: text.slice(start, end) })
      at = end
    }
    return [...parts, text.slice(at)].filter((part) => part !== '')
  })
}
