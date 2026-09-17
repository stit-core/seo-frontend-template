export const prerender = false

import type { APIRoute } from 'astro'
import { blogFeed } from './_blog/feed'

export const GET: APIRoute = () => blogFeed('ru')
