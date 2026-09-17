import { createFileRoute } from '@tanstack/react-router'
import { getResponse } from 'msw'
import { buildHandlers } from '@/shared/api/mock/handlers'

// Splat-роут отдаёт весь /api/v2/* в msw — переиспользование хендлеров SPA
// на сервере без Service Worker.
export const Route = createFileRoute('/api/v2/$')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // getResponse возвращает Response | undefined (несматченный запрос)
        return (await getResponse(buildHandlers(), request)) ?? new Response(null, { status: 501 })
      },
    },
  },
})
