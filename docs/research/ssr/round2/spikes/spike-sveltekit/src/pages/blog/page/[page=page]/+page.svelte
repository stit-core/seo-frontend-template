<script lang="ts">
import { PostCard } from '@/entities/post'
import { getLocale, localizeHref, m } from '@/shared/i18n'
import { type Locale, SeoHead } from '@/shared/seo'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()
const locale = getLocale() as Locale
</script>

<SeoHead
  origin={data.origin}
  path={`/blog/page/${data.page}`}
  {locale}
  title={`${m.blog_title()} — ${m.blog_page({ n: data.page })}`}
  description={m.blog_lead()}
  robotsPolicy={data.robotsPolicy}
/>

<section class="shell">
  <h1>{m.blog_title()} — {m.blog_page({ n: data.page })}</h1>
  {#each data.posts as post (post.slug)}
    <PostCard {post} href={localizeHref(`/blog/${post.slug}`)} {locale} />
  {/each}
  <nav class="pagination" aria-label="Пагинация">
    <a href={localizeHref(data.page === 2 ? '/blog' : `/blog/page/${data.page - 1}`)} rel="prev"
      >{m.blog_prev()}</a
    >
    <span>{m.blog_page({ n: data.page })} / {data.pages}</span>
    {#if data.page < data.pages}
      <a href={localizeHref(`/blog/page/${data.page + 1}`)} rel="next">{m.blog_next()}</a>
    {/if}
  </nav>
</section>
