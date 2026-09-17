<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useLocalePath } from '#i18n'
import { useSeoMeta } from '#imports'
import { absoluteUrl } from '@/shared/seo'

const { t } = useI18n()
const localePath = useLocalePath()

const canonical = absoluteUrl(localePath('/about'))

useSeoMeta({
  title: () => t('about.title'),
  description: () => t('about.description'),
  ogTitle: () => t('about.title'),
  ogDescription: () => t('about.description'),
  ogType: 'website',
  ogUrl: canonical,
})
</script>

<template>
  <article class="mx-auto max-w-5xl px-6 py-12">
    <h1 class="text-heading-xl font-bold">{{ t('about.title') }}</h1>
    <p class="text-body-md text-muted mt-4 max-w-2xl">{{ t('about.body') }}</p>
  </article>
</template>
