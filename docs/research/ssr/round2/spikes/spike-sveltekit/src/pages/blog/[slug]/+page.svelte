<script lang="ts">
import { PostCover } from '@/entities/post'
import { getLocale, localizeHref, m } from '@/shared/i18n'
import { formatDate } from '@/shared/lib'
import { articleJsonLd, breadcrumbJsonLd, type Locale, SeoHead } from '@/shared/seo'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()
const locale = getLocale() as Locale
const post = $derived(data.post)
const path = $derived(`/blog/${post.slug}`)
</script>

<SeoHead
  origin={data.origin}
  {path}
  {locale}
  title={post.title}
  description={post.description}
  robotsPolicy={data.robotsPolicy}
  ogType="article"
  image={`/og/${post.slug}.png`}
  jsonLd={[
    breadcrumbJsonLd(
      data.origin,
      [
        { name: m.breadcrumb_home(), path: '/' },
        { name: m.blog_title(), path: '/blog' },
        { name: post.title, path },
      ],
      locale,
    ),
    articleJsonLd({
      origin: data.origin,
      path,
      locale,
      headline: post.title,
      description: post.description,
      datePublished: post.pubDate,
      dateModified: post.updatedDate,
      image: `/og/${post.slug}.png`,
    }),
  ]}
/>

<nav class="shell breadcrumbs" aria-label="Хлебные крошки">
  <a href={localizeHref('/')}>{m.breadcrumb_home()}</a>
  <span aria-hidden="true">/</span>
  <a href={localizeHref('/blog')}>{m.blog_title()}</a>
</nav>

<article class="shell">
  <h1>{post.title}</h1>
  <p class="post-card__meta">
    <time datetime={post.pubDate}>{m.published()}: {formatDate(post.pubDate, locale)}</time>
    <time datetime={post.updatedDate}>{m.updated()}: {formatDate(post.updatedDate, locale)}</time>
  </p>
  <PostCover
    slug={post.slug}
    alt={post.title}
    priority
    sizes="(min-width: 48rem) 720px, 100vw"
    class="post-card__cover"
  />
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  <div class="prose">{@html data.html}</div>
  <nav class="pagination" aria-label="Соседние материалы">
    {#if data.prev}
      <a href={localizeHref(`/blog/${data.prev.slug}`)} rel="prev">← {data.prev.title}</a>
    {/if}
    {#if data.next}
      <a href={localizeHref(`/blog/${data.next.slug}`)} rel="next">{data.next.title} →</a>
    {/if}
  </nav>
</article>
