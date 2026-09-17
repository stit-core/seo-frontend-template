import type { Page } from 'astro'

/**
 * Пагинация для on-demand режима: `paginate()` из getStaticPaths там не работает,
 * а форма `Page<T>` нужна шаблону такой же, как в prerender.
 */
export function paginateOnDemand<T>(
  items: T[],
  rawPage: string | undefined,
  base: string,
  pageSize: number,
): Page<T> {
  const lastPage = Math.max(1, Math.ceil(items.length / pageSize))
  const current = Math.min(Math.max(Number.parseInt(rawPage ?? '1', 10) || 1, 1), lastPage)
  const start = (current - 1) * pageSize
  const data = items.slice(start, start + pageSize)
  const url = (n: number) => (n === 1 ? base : `${base}/page/${n}`)
  return {
    data,
    start,
    end: start + data.length - 1,
    total: items.length,
    currentPage: current,
    size: pageSize,
    lastPage,
    url: {
      current: url(current),
      first: current > 1 ? url(1) : undefined,
      last: current < lastPage ? url(lastPage) : undefined,
      next: current < lastPage ? url(current + 1) : undefined,
      prev: current > 1 ? url(current - 1) : undefined,
    },
  }
}
