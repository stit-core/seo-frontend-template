import { LRUCache } from 'lru-cache'

export type CacheState = 'HIT' | 'MISS' | 'STALE' | 'BYPASS'

interface Entry {
  body: string
  status: number
  headers: [string, string][]
  storedAt: number
}

export interface HtmlCacheOptions {
  /** Сколько секунд ответ считается свежим. 0 — кеш выключен. */
  ttlSec: number
  /** Сколько секунд после TTL можно отдавать протухший ответ, обновляя его в фоне. */
  swrSec: number
  max: number
}

export interface CacheStats {
  hit: number
  miss: number
  stale: number
  renders: number
  size: number
}

export class HtmlCache {
  readonly #cache: LRUCache<string, Entry>
  readonly #inflight = new Map<string, Promise<Entry>>()
  readonly #opts: HtmlCacheOptions
  #stats = { hit: 0, miss: 0, stale: 0, renders: 0 }

  constructor(opts: HtmlCacheOptions) {
    this.#opts = opts
    this.#cache = new LRUCache<string, Entry>({
      max: opts.max,
      ttl: (opts.ttlSec + opts.swrSec) * 1000 || 1,
    })
  }

  get enabled(): boolean {
    return this.#opts.ttlSec > 0
  }

  stats(): CacheStats {
    return { ...this.#stats, size: this.#cache.size }
  }

  /** Сбрасывает один путь (точное совпадение ключа) или весь кеш. */
  invalidate(key?: string): number {
    if (!key) {
      const n = this.#cache.size
      this.#cache.clear()
      return n
    }
    let n = 0
    for (const k of [...this.#cache.keys()]) {
      if (k === key || k.startsWith(`${key}|`)) {
        this.#cache.delete(k)
        n++
      }
    }
    return n
  }

  async wrap(
    key: string,
    render: () => Promise<Response>,
  ): Promise<{ response: Response; state: CacheState }> {
    if (!this.enabled) return { response: await render(), state: 'BYPASS' }

    const entry = this.#cache.get(key)
    const now = Date.now()

    if (entry) {
      const age = (now - entry.storedAt) / 1000
      if (age <= this.#opts.ttlSec) {
        this.#stats.hit++
        return { response: this.#toResponse(entry, 'HIT', age), state: 'HIT' }
      }
      this.#stats.stale++
      // stale-while-revalidate: отдаём протухшее, обновляем в фоне без ожидания.
      void this.#load(key, render).catch(() => undefined)
      return { response: this.#toResponse(entry, 'STALE', age), state: 'STALE' }
    }

    this.#stats.miss++
    const fresh = await this.#load(key, render)
    return { response: this.#toResponse(fresh, 'MISS', 0), state: 'MISS' }
  }

  /** Single-flight: на холодный кеш N параллельных запросов дают один рендер. */
  #load(key: string, render: () => Promise<Response>): Promise<Entry> {
    const pending = this.#inflight.get(key)
    if (pending) return pending

    const task = (async () => {
      this.#stats.renders++
      const response = await render()
      const headers: [string, string][] = []
      response.headers.forEach((value, name) => {
        if (name !== 'content-length' && name !== 'content-encoding') headers.push([name, value])
      })
      const entry: Entry = {
        body: await response.text(),
        status: response.status,
        headers,
        storedAt: Date.now(),
      }
      const cacheable =
        response.status === 200 &&
        (response.headers.get('content-type') ?? '').startsWith('text/html')
      if (cacheable) this.#cache.set(key, entry)
      return entry
    })()

    this.#inflight.set(key, task)
    task.finally(() => this.#inflight.delete(key))
    return task
  }

  #toResponse(entry: Entry, state: CacheState, age: number): Response {
    const headers = new Headers(entry.headers)
    headers.set('x-cache', state)
    headers.set('age', String(Math.floor(age)))
    return new Response(entry.body, { status: entry.status, headers })
  }
}

/** Ключ кеша: метод + путь + локаль. Ни cookie, ни User-Agent в ключе нет. */
export function cacheKey(method: string, pathname: string, locale: string): string {
  return `${method} ${pathname}|${locale}`
}
