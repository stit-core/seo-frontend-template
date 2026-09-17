import { queryCollection } from '#imports'
import { POSTS_PER_PAGE } from '../model/schema'

export type PostCollection = 'postsRu' | 'postsEn'

export function postCollection(locale: string): PostCollection {
  return locale === 'en' ? 'postsEn' : 'postsRu'
}

export function blogBasePath(locale: string): string {
  return locale === 'en' ? '/en/blog' : '/blog'
}

export function postListQuery(locale: string, page: number) {
  return queryCollection(postCollection(locale))
    .select('path', 'title', 'description', 'pubDate', 'updatedDate', 'cover', 'tags')
    .order('pubDate', 'DESC')
    .skip((page - 1) * POSTS_PER_PAGE)
    .limit(POSTS_PER_PAGE)
    .all()
}

export function postCountQuery(locale: string) {
  return queryCollection(postCollection(locale)).count()
}

export function latestPostsQuery(locale: string, limit: number) {
  return queryCollection(postCollection(locale))
    .select('path', 'title', 'description', 'pubDate', 'cover')
    .order('pubDate', 'DESC')
    .limit(limit)
    .all()
}

export function postByPathQuery(locale: string, path: string) {
  return queryCollection(postCollection(locale)).path(path).first()
}

export function postPathsQuery(locale: string) {
  return queryCollection(postCollection(locale)).select('path', 'updatedDate').all()
}
