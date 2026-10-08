import type { APIRoute } from 'astro'
import { blogFeed } from '../_blog/feed'

export const GET: APIRoute = () => blogFeed('en')
