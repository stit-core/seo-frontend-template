<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { NuxtLink } from '#components'
import { useLocalePath } from '#i18n'
import { createError, useAsyncData, useRoute, useSeoMeta } from '#imports'
import { POSTS_PER_PAGE, postCountQuery, postListQuery } from '@/entities/post'
import { absoluteUrl } from '@/shared/seo'
import { PostList } from '@/widgets/post-list'

const { t, locale } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

const page = Number(route.params.page)
if (!Number.isInteger(page) || page < 2) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}

const { data } = await useAsyncData(
  () => `blog-${page}-${locale.value}`,
  async () => ({
    items: await postListQuery(locale.value, page),
    total: await postCountQuery(locale.value),
  }),
  { watch: [locale] },
)

if (!data.value?.items.length) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}

const totalPages = () => Math.max(1, Math.ceil((data.value?.total ?? 0) / POSTS_PER_PAGE))
const prevHref = () => (page === 2 ? localePath('/blog') : localePath(`/blog/page/${page - 1}`))

const canonical = absoluteUrl(localePath(`/blog/page/${page}`))

useSeoMeta({
  title: () => `${t('blog.title')} — ${t('blog.page')} ${page}`,
  description: () => t('blog.description'),
  ogUrl: canonical,
})
</script>

<template>
  <section class="mx-auto max-w-5xl px-6 py-12">
    <h1 class="text-heading-xl font-bold mb-8">
      {{ t('blog.title') }} — {{ t('blog.page') }} {{ page }}
    </h1>
    <PostList :items="data?.items ?? []" :locale="locale" />
    <nav class="mt-8 flex gap-3 text-body-sm" aria-label="pagination">
      <NuxtLink :to="prevHref()">{{ t('blog.prev') }}</NuxtLink>
      <span aria-current="page">{{ t('blog.page') }} {{ page }}</span>
      <NuxtLink v-if="page < totalPages()" :to="localePath(`/blog/page/${page + 1}`)">{{
        t('blog.next')
      }}</NuxtLink>
    </nav>
  </section>
</template>
