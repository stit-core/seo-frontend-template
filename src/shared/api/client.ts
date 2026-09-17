import { runtimeConfig } from '@/shared/config'

// Общий HTTP-клиент поверх fetch. Cookie-auth: credentials 'include' гонит
// httpOnly-cookie сессии; CSRF-токен из cookie дублируется заголовком на
// мутирующих методах. Контракт API типизируется рукописными zod-схемами в
// entities/*/model — клиент возвращает unknown, ответ парсит вызывающая сторона.

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, url: string) {
    super(`API ${status}: ${url}`)
    this.name = 'ApiError'
    this.status = status
  }
}

interface RequestOptions {
  body?: unknown
  signal?: AbortSignal
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

async function request(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<unknown> {
  const url = `${runtimeConfig.API_BASE_URL}${path}`
  const headers = new Headers()
  if (options.body !== undefined) headers.set('Content-Type', 'application/json')
  if (MUTATING_METHODS.has(method)) {
    const csrf = readCookie('csrf_token')
    if (csrf) headers.set('X-CSRF-Token', csrf)
  }

  const response = await fetch(url, {
    method,
    headers,
    credentials: 'include',
    body: options.body !== undefined ? JSON.stringify(options.body) : null,
    signal: options.signal ?? null,
  })

  if (!response.ok) throw new ApiError(response.status, url)
  if (response.status === 204) return undefined
  return response.json()
}

// Пути передаются относительно API_BASE_URL (дефолт /api): get('/v1/todos').
export const apiClient = {
  get: (path: string, options?: RequestOptions) => request('GET', path, options),
  post: (path: string, options?: RequestOptions) => request('POST', path, options),
  put: (path: string, options?: RequestOptions) => request('PUT', path, options),
  patch: (path: string, options?: RequestOptions) => request('PATCH', path, options),
  delete: (path: string, options?: RequestOptions) => request('DELETE', path, options),
}

function readCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match?.[1]
}
