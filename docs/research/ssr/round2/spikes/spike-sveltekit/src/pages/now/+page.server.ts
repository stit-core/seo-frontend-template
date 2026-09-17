import type { PageServerLoad } from './$types'

// Демонстрация on-demand: страница обязана считаться на каждый запрос.
export const prerender = false

export const load: PageServerLoad = ({ setHeaders }) => {
  setHeaders({ 'cache-control': 'no-cache' })
  return { serverTime: new Date().toISOString(), uptimeSec: Math.round(process.uptime()) }
}
