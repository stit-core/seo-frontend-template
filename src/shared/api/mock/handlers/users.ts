import { HttpResponse, http } from 'msw'
import type { DB } from '../db'

export function userHandlers(db: DB) {
  return [
    http.get('/api/v1/users/:id', ({ params }) => {
      const user = db.user.findFirst({ where: { id: { equals: String(params.id) } } })
      if (!user) return new HttpResponse(null, { status: 404 })
      return HttpResponse.json({
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      })
    }),
  ]
}
