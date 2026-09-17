<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useLocalePath } from '#i18n'
import { defineOgImageComponent, useAsyncData, useSeoMeta } from '#imports'
import { latestPostsQuery } from '@/entities/post'
import { absoluteUrl } from '@/shared/seo'
import { Hero } from '@/widgets/hero'
import { PostList } from '@/widgets/post-list'

const { t, locale } = useI18n()
const localePath = useLocalePath()

const { data: posts } = await useAsyncData(
  () => `home-${locale.value}`,
  () => latestPostsQuery(locale.value, 3),
  { watch: [locale] },
)

// absoluteUrl читает runtimeConfig, поэтому вызывается в setup, а не в ленивом геттере head
const canonical = absoluteUrl(localePath('/'))

useSeoMeta({
  title: () => t('home.title'),
  description: () => t('home.description'),
  ogTitle: () => t('home.title'),
  ogDescription: () => t('home.description'),
  ogType: 'website',
  ogUrl: canonical,
  twitterCard: 'summary_large_image',
})

defineOgImageComponent('Default', { title: 'stit demo', description: 'HTML-first content site' })
</script>

<template>
  <div>
    <Hero
      :title="t('home.heroTitle')"
      :lead="t('home.heroLead')"
      :cta="t('home.cta')"
      :cta-href="localePath('/blog')"
    />
    <section class="mx-auto max-w-5xl px-6 pb-12">
      <h2 class="text-heading-lg font-semibold mb-6">{{ t('home.latest') }}</h2>
      <PostList :items="posts ?? []" :locale="locale" />
    </section>
  </div>
</template>
