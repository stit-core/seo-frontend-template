import { allPosts } from '@/entities/post'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = () => ({ posts: allPosts().slice(0, 3) })
