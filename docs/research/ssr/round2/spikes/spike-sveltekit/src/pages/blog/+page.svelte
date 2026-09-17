<script lang="ts">
import { PostCard } from '@/entities/post'
import { getLocale, localizeHref, m } from '@/shared/i18n'
import { breadcrumbJsonLd, type Locale, SeoHead } from '@/shared/seo'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()
const locale = getLocale() as Locale
</script>

<SeoHead
  origin={data.origin}
  path="/blog"
  {locale}
  title={m.blog_title()}
  description={m.blog_lead()}
  robotsPolicy={data.robotsPolicy}
  jsonLd={[breadcrumbJsonLd(data.origin, [{ name: m.breadcrumb_home(), path: '/' }, { name: m.blog_title(), path: '/blog' }], locale)]}
/>

<section class="shell">
  <h1>{m.blog_title()}</h1>
  <p class="lead">{m.blog_lead()}</p>
  {#each data.posts as post (post.slug)}
    <PostCard {post} href={localizeHref(`/blog/${post.slug}`)} {locale} />
  {/each}
  <nav class="pagination" aria-label="Пагинация">
    <span>{m.blog_page({ n: data.page })} / {data.pages}</span>
    <a href={localizeHref('/blog/page/2')} rel="next">{m.blog_next()}</a>
  </nav>
</section>
