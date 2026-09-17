import type { Post } from '@/entities/post/model/schema'
export const GET = (): Response => new Response(String([] as Post[]))
