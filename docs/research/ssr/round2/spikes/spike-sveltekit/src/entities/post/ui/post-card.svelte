<script lang="ts">
import { formatDate } from '@/shared/lib'
import type { PostMeta } from '../model/schema'
import PostCover from './post-cover.svelte'

interface Props {
  post: PostMeta
  href: string
  locale: string
  priority?: boolean
}

let { post, href, locale, priority = false }: Props = $props()
</script>

<article class="post-card">
  <a {href} class="post-card__link">
    <PostCover
      slug={post.slug}
      alt={post.title}
      {priority}
      sizes="(min-width: 48rem) 360px, 100vw"
      class="post-card__cover"
    />
    <h3 class="post-card__title">{post.title}</h3>
  </a>
  <p class="post-card__desc">{post.description}</p>
  <p class="post-card__meta">
    <time datetime={post.pubDate}>{formatDate(post.pubDate, locale)}</time>
    <span class="post-card__tags">{post.tags.map((t) => `#${t}`).join(' ')}</span>
  </p>
</article>
