import { createIsomorphicFn } from '@tanstack/react-start'
import { getRequestHeader, getRequestUrl } from '@tanstack/react-start/server'

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, url: string) {
    super(`API ${status}: ${url}`)
    this.name = 'ApiError'
    this.status = status
  }
}

// На сервере fetch требует абсолютный URL и ручной проброс cookie:
// внутренний вызов не наследует заголовки входящего запроса сам.
const resolveRequest = createIsomorphicFn()
  .server((path: string): [string, RequestInit] => {
    const origin = getRequestUrl().origin
    const cookie = getRequestHeader('cookie')
    return [new URL(path, origin).toString(), cookie ? { headers: { cookie } } : {}]
  })
  .client((path: string): [string, RequestInit] => [path, { credentials: 'include' }])

export async function apiFetch(path: string): Promise<unknown> {
  const [url, init] = resolveRequest(path)
  const response = await fetch(url, init)
  if (!response.ok) throw new ApiError(response.status, url)
  return response.json()
}
