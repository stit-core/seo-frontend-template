<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ContentRenderer, NuxtLink, NuxtPicture } from '#components'
import { useLocalePath } from '#i18n'
import {
  createError,
  defineArticle,
  defineBreadcrumb,
  defineOgImageComponent,
  useAsyncData,
  useRoute,
  useSchemaOrg,
  useSeoMeta,
} from '#imports'
import { postByPathQuery } from '@/entities/post'
import { absoluteUrl, formatDate } from '@/shared/seo'

const { t, locale } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

const { data: post } = await useAsyncData(
  () => `post-${route.path}`,
  () => postByPathQuery(locale.value, route.path),
)

if (!post.value) {
  throw createError({ statusCode: 404, statusMessage: 'Post not found', fatal: true })
}

const canonical = absoluteUrl(route.path)
const coverUrl = absoluteUrl(post.value.cover)

useSeoMeta({
  title: () => post.value?.title ?? '',
  description: () => post.value?.description ?? '',
  ogTitle: () => post.value?.title ?? '',
  ogDescription: () => post.value?.description ?? '',
  ogType: 'article',
  ogUrl: canonical,
  ogImage: coverUrl,
  articlePublishedTime: () => post.value?.pubDate,
  articleModifiedTime: () => post.value?.updatedDate,
  twitterCard: 'summary_large_image',
})

useSchemaOrg([
  defineArticle({
    headline: post.value.title,
    description: post.value.description,
    image: coverUrl,
    datePublished: post.value.pubDate,
    dateModified: post.value.updatedDate,
    inLanguage: locale.value === 'en' ? 'en-US' : 'ru-RU',
  }),
  defineBreadcrumb({
    itemListElement: [
      { name: 'stit demo', item: localePath('/') },
      { name: t('blog.title'), item: localePath('/blog') },
      { name: post.value.title },
    ],
  }),
])

defineOgImageComponent('Default', {
  title: post.value.title,
  description: post.value.description,
})
</script>

<template>
  <article v-if="post" class="mx-auto max-w-3xl px-6 py-12">
    <nav aria-label="breadcrumb" class="text-body-sm text-muted">
      <NuxtLink :to="localePath('/')">stit demo</NuxtLink>
      <span> / </span>
      <NuxtLink :to="localePath('/blog')">{{ t('blog.title') }}</NuxtLink>
    </nav>

    <h1 class="text-heading-xl font-bold mt-4">{{ post.title }}</h1>
    <p class="text-body-md text-muted mt-3">{{ post.description }}</p>
    <p class="text-body-sm text-muted mt-2">
      <time :datetime="post.pubDate">{{ formatDate(post.pubDate, locale) }}</time>
      <span> · {{ t('blog.updated') }} </span>
      <time :datetime="post.updatedDate">{{ formatDate(post.updatedDate, locale) }}</time>
    </p>

    <NuxtPicture
      :src="post.cover"
      :alt="post.title"
      width="1600"
      height="900"
      sizes="100vw md:768px"
      format="avif,webp"
      densities="1x"
      loading="eager"
      fetchpriority="high"
      class="mt-6 block"
      :img-attrs="{ class: 'w-full h-auto rounded-control' }"
    />

    <div class="prose-content mt-8">
      <ContentRenderer :value="post" />
    </div>

    <p class="mt-10 text-body-sm">
      <NuxtLink :to="localePath('/blog')" class="underline">{{ t('blog.backToBlog') }}</NuxtLink>
    </p>
  </article>
</template>
