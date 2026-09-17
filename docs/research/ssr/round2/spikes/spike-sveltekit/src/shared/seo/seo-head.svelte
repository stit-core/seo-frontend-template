<script lang="ts">
import { SITE_NAME } from '@/shared/config'
import { absoluteUrl, alternateLinks, jsonLdTag, type Locale, robotsContent } from './meta'

interface Props {
  origin: string
  path: string
  locale: Locale
  title: string
  description: string
  robotsPolicy: 'index' | 'noindex'
  indexable?: boolean
  ogType?: 'website' | 'article'
  image?: string
  jsonLd?: string[]
}

let {
  origin,
  path,
  locale,
  title,
  description,
  robotsPolicy,
  indexable = true,
  ogType = 'website',
  image = '/og-default.png',
  jsonLd = [],
}: Props = $props()

const canonical = $derived(absoluteUrl(origin, path, locale))
const alternates = $derived(alternateLinks(origin, path))
const fullTitle = $derived(`${title} — ${SITE_NAME}`)
const ogImage = $derived(image.startsWith('http') ? image : `${origin}${image}`)
</script>

<svelte:head>
  <title>{fullTitle}</title>
  <meta name="description" content={description}>
  <meta name="robots" content={robotsContent(indexable, robotsPolicy)}>
  <link rel="canonical" href={canonical}>
  {#each alternates as alt (alt.hreflang)}
    <link rel="alternate" hreflang={alt.hreflang} href={alt.href}>
  {/each}
  <meta property="og:site_name" content={SITE_NAME}>
  <meta property="og:type" content={ogType}>
  <meta property="og:title" content={fullTitle}>
  <meta property="og:description" content={description}>
  <meta property="og:url" content={canonical}>
  <meta property="og:image" content={ogImage}>
  <meta property="og:locale" content={locale === 'en' ? 'en_GB' : 'ru_RU'}>
  <meta name="twitter:card" content="summary_large_image">
  {#each jsonLd as block, i (i)}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html jsonLdTag(block)}
  {/each}
</svelte:head>
