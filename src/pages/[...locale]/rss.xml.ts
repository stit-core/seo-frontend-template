import type { APIRoute, GetStaticPaths, InferGetStaticPropsType } from 'astro'
import { localeRoutes } from '@/shared/strategy'
import { blogFeed } from '../_blog/feed'

// Фид — у каждой локали, где есть блог.
export const getStaticPaths = (() => localeRoutes('blog')) satisfies GetStaticPaths

export const GET: APIRoute<InferGetStaticPropsType<typeof getStaticPaths>> = ({ props }) =>
  blogFeed(props.locale)
