import { type Post, PostCard } from '@/entities/post'
import type { Locale } from '@/shared/i18n'

export function PostList({ posts, locale }: { posts: Post[]; locale: Locale }) {
  return (
    <div>
      {posts.map((post) => (
        <PostCard key={post.slug} post={post} locale={locale} />
      ))}
    </div>
  )
}
