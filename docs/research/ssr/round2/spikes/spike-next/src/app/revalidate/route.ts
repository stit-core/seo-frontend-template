import { revalidatePath } from 'next/cache'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

// revalidatePath на prerender-маршруте перерисовывает его с текущим process.env —
// это и есть механизм «штамповки» runtime SITE_URL без плейсхолдеров.
export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  if (secret !== (process.env.REVALIDATE_SECRET ?? 'dev-secret')) {
    return Response.json({ ok: false }, { status: 401 })
  }

  const params = request.nextUrl.searchParams
  const path = params.get('path') ?? '/ru/blog'
  const type = params.get('type')

  if (type === 'layout' || type === 'page') revalidatePath(path, type)
  else revalidatePath(path)

  return Response.json({ ok: true, revalidated: path, type: type ?? 'auto', now: Date.now() })
}
