<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { NuxtLink } from '#components'
import { useLocalePath } from '#i18n'
import { useAsyncData, useSeoMeta } from '#imports'
import { POSTS_PER_PAGE, postCountQuery, postListQuery } from '@/entities/post'
import { absoluteUrl } from '@/shared/seo'
import { PostList } from '@/widgets/post-list'

const { t, locale } = useI18n()
const localePath = useLocalePath()

const { data } = await useAsyncData(
  () => `blog-1-${locale.value}`,
  async () => ({
    items: await postListQuery(locale.value, 1),
    total: await postCountQuery(locale.value),
  }),
  { watch: [locale] },
)

const totalPages = () => Math.max(1, Math.ceil((data.value?.total ?? 0) / POSTS_PER_PAGE))

const canonical = absoluteUrl(localePath('/blog'))

useSeoMeta({
  title: () => t('blog.title'),
  description: () => t('blog.description'),
  ogTitle: () => t('blog.title'),
  ogDescription: () => t('blog.description'),
  ogType: 'website',
  ogUrl: canonical,
})
</script>

<template>
  <section class="mx-auto max-w-5xl px-6 py-12">
    <h1 class="text-heading-xl font-bold mb-8">{{ t('blog.title') }}</h1>
    <PostList :items="data?.items ?? []" :locale="locale" />
    <nav class="mt-8 flex gap-3 text-body-sm" aria-label="pagination">
      <span aria-current="page">{{ t('blog.page') }} 1</span>
      <NuxtLink v-if="totalPages() > 1" :to="localePath('/blog/page/2')">{{
        t('blog.next')
      }}</NuxtLink>
    </nav>
  </section>
</template>
