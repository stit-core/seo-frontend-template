import { HttpResponse, http } from 'msw'
import type { DB } from '../db'

export function todoHandlers(db: DB) {
  return [
    http.get('/api/v1/todos', ({ cookies }) => {
      const sessionId = cookies.app_session
      if (!sessionId) return new HttpResponse(null, { status: 401 })
      const session = db.session.findFirst({ where: { id: { equals: sessionId } } })
      if (!session) return new HttpResponse(null, { status: 401 })
      const todos = db.todo.findMany({ where: { ownerId: { equals: session.userId } } })
      return HttpResponse.json(
        todos.map((t) => ({
          id: t.id,
          title: t.title,
          done: t.done,
          createdAt: t.createdAt,
        })),
      )
    }),

    http.post('/api/v1/todos', async ({ request, cookies }) => {
      const sessionId = cookies.app_session
      if (!sessionId) return new HttpResponse(null, { status: 401 })
      const session = db.session.findFirst({ where: { id: { equals: sessionId } } })
      if (!session) return new HttpResponse(null, { status: 401 })

      const body = (await request.json()) as { title: string }
      const todo = db.todo.create({
        id: `todo-${Date.now()}`,
        title: body.title,
        done: false,
        createdAt: new Date().toISOString(),
        ownerId: session.userId,
      })
      return HttpResponse.json(
        { id: todo.id, title: todo.title, done: todo.done, createdAt: todo.createdAt },
        { status: 201 },
      )
    }),

    http.patch('/api/v1/todos/:id', async ({ request, params }) => {
      const id = String(params.id)
      const body = (await request.json()) as { done?: boolean; title?: string }
      const updated = db.todo.update({
        where: { id: { equals: id } },
        data: {
          ...(body.done !== undefined && { done: body.done }),
          ...(body.title && { title: body.title }),
        },
      })
      if (!updated) return new HttpResponse(null, { status: 404 })
      return HttpResponse.json({
        id: updated.id,
        title: updated.title,
        done: updated.done,
        createdAt: updated.createdAt,
      })
    }),

    http.delete('/api/v1/todos/:id', ({ params }) => {
      const deleted = db.todo.delete({ where: { id: { equals: String(params.id) } } })
      if (!deleted) return new HttpResponse(null, { status: 404 })
      return new HttpResponse(null, { status: 204 })
    }),
  ]
}
