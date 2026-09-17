// Счётчик реальных рендеров страницы: отличает кеш-хит от настоящего рендера
// в замере «200 параллельных запросов на холодный кеш».
const counters = new Map<string, number>()

export function countRender(key: string): number {
  const next = (counters.get(key) ?? 0) + 1
  counters.set(key, next)
  return next
}

export function renderCounts(): Record<string, number> {
  return Object.fromEntries(counters)
}
