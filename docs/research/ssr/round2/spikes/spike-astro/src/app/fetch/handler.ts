import { astro, FetchState } from 'astro/fetch'
import { getRuntimeConfig } from '@/shared/config'

// Единственная точка, через которую проходит весь on-demand-трафик.
// ⚠️ Prerendered-страницы сюда НЕ попадают: их отдаёт статик-хендлер адаптера
// раньше приложения — поэтому runtime-заголовки для них ставит только Traefik.
export default {
  async fetch(request: Request): Promise<Response> {
    const response = await astro(new FetchState(request))
    const { ROBOTS_POLICY } = getRuntimeConfig()

    if (ROBOTS_POLICY === 'noindex') {
      response.headers.set('x-robots-tag', 'noindex, nofollow')
    }

    // Кеш-провайдер Astro не проставляет публичный Cache-Control: в ответе
    // остаётся только X-Astro-Cache. Для браузера/прокси дописываем явно.
    const contentType = response.headers.get('content-type') ?? ''
    if (!response.headers.has('cache-control') && contentType.startsWith('text/html')) {
      response.headers.set('cache-control', 'no-cache')
    }
    return response
  },
}
