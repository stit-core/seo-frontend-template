export const prerender = false

import type { APIRoute } from 'astro'
import { getRuntimeConfig } from '@/shared/config'

// Ключ IndexNow подтверждается файлом /<ключ>.txt с самим ключом внутри (indexnow.org); значение —
// runtime env, поэтому маршрут on-demand. Параметризованный маршрут ловит весь корневой *.txt
// (статический robots.txt Astro сопоставляет раньше): без ключа или с чужим именем — plain-text
// 404, до 404.astro такой путь не доходит.
export const GET: APIRoute = ({ params }) => {
  const { INDEXNOW_KEY } = getRuntimeConfig()
  if (INDEXNOW_KEY === '' || params.key !== INDEXNOW_KEY) {
    return new Response('Not found', {
      status: 404,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-cache',
        'x-robots-tag': 'noindex',
      },
    })
  }
  return new Response(INDEXNOW_KEY, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=300',
      'x-robots-tag': 'noindex',
    },
  })
}
