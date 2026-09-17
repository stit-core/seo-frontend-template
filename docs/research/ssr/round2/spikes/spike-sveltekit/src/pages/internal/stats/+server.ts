import { json } from '@sveltejs/kit'
import { htmlCache } from '@/app/hooks.server'
import type { RequestHandler } from './$types'

export const prerender = false

export const GET: RequestHandler = () =>
  json(htmlCache.stats(), { headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } })
