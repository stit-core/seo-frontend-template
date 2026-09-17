<script lang="ts">
import { PostCard } from '@/entities/post'
import { getLocale, localizeHref, m } from '@/shared/i18n'
import { type Locale, SeoHead, websiteJsonLd } from '@/shared/seo'
import { Hero } from '@/widgets/hero'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()
const locale = getLocale() as Locale
</script>

<SeoHead
  origin={data.origin}
  path="/"
  {locale}
  title={m.site_tagline()}
  description={m.home_hero_lead()}
  robotsPolicy={data.robotsPolicy}
  jsonLd={[websiteJsonLd(data.origin)]}
/>

<Hero />

<section class="shell">
  <h2>{m.home_latest()}</h2>
  {#each data.posts as post, i (post.slug)}
    <PostCard {post} href={localizeHref(`/blog/${post.slug}`)} {locale} priority={i === 0} />
  {/each}
</section>
