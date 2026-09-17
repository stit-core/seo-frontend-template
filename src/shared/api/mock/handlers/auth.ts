import { HttpResponse, http } from 'msw'
import type { DB } from '../db'

export function authHandlers(db: DB) {
  return [
    http.post('/api/v1/auth/login', async ({ request, cookies: _cookies }) => {
      const body = (await request.json()) as { email: string; password: string }
      const user = db.user.findFirst({
        where: { email: { equals: body.email }, password: { equals: body.password } },
      })
      if (!user) return HttpResponse.json({ message: 'invalid credentials' }, { status: 401 })
      const session = db.session.create({
        id: `session-${Date.now()}`,
        userId: user.id,
        email: user.email,
        createdAt: new Date().toISOString(),
      })
      return HttpResponse.json(
        { userId: session.userId, email: session.email, createdAt: session.createdAt },
        {
          status: 200,
          headers: {
            'Set-Cookie': `app_session=${session.id}; Path=/; SameSite=Lax`,
          },
        },
      )
    }),

    http.post('/api/v1/auth/logout', () => {
      db.session.deleteMany({ where: {} })
      return new HttpResponse(null, {
        status: 204,
        headers: { 'Set-Cookie': 'app_session=; Path=/; Max-Age=0' },
      })
    }),

    http.get('/api/v1/session', ({ cookies }) => {
      const sessionId = cookies.app_session
      const session = sessionId
        ? db.session.findFirst({ where: { id: { equals: sessionId } } })
        : null
      if (!session) return new HttpResponse(null, { status: 401 })
      return HttpResponse.json({
        userId: session.userId,
        email: session.email,
        createdAt: session.createdAt,
      })
    }),
  ]
}
