import { HttpResponse, http } from 'msw'
import { findPost, mockPosts } from './posts'

// Те же msw-хендлеры, что в SPA-шаблоне, только исполняются на сервере
// (msw/node не нужен — getResponse матчит Request напрямую).
export function buildHandlers() {
  return [
    http.get('*/api/v2/posts', () => HttpResponse.json(mockPosts)),
    http.get('*/api/v2/posts/:slug', ({ params }) => {
      const post = findPost(String(params.slug))
      return post ? HttpResponse.json(post) : new HttpResponse(null, { status: 404 })
    }),
  ]
}
