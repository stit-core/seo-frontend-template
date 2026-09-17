import { PostSchema } from '@/entities/post/model/schema'
export const GET = () => new Response(String(!!PostSchema))
