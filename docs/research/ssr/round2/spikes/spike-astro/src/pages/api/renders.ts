export const prerender = false

import type { APIRoute } from 'astro'
import { renderCounts } from '@/shared/lib'

// Диагностика спайка: сколько раз каждый маршрут реально отрендерился.
export const GET: APIRoute = () =>
  Response.json(renderCounts(), { headers: { 'cache-control': 'no-store' } })
