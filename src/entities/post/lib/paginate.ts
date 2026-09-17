export const POSTS_PER_PAGE = 5

export interface Page<T> {
  readonly items: readonly T[]
  readonly current: number
  readonly last: number
  readonly total: number
}

export function pageCount(total: number, perPage = POSTS_PER_PAGE): number {
  return Math.max(1, Math.ceil(total / perPage))
}

// Страницы вне диапазона не «зажимаются»: их не должно существовать (честный 404 в
// getStaticPaths), поэтому запрос такой страницы — ошибка программиста.
export function paginate<T>(
  items: readonly T[],
  current: number,
  perPage = POSTS_PER_PAGE,
): Page<T> {
  const last = pageCount(items.length, perPage)
  if (!Number.isInteger(current) || current < 1 || current > last) {
    throw new Error(`paginate: страницы ${current} нет (всего ${last})`)
  }
  const start = (current - 1) * perPage
  return { items: items.slice(start, start + perPage), current, last, total: items.length }
}
