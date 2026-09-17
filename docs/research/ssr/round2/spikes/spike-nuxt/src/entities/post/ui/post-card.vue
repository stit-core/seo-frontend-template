<script setup lang="ts">
import { NuxtImg, NuxtLink } from '#components'
import { formatDate } from '@/shared/seo'

defineProps<{
  path: string
  title: string
  description: string
  pubDate: string
  cover: string
  locale: string
  eager?: boolean
}>()
</script>

<template>
  <article class="rounded-control border border-divider bg-surface overflow-hidden">
    <NuxtLink :to="path" class="block">
      <NuxtImg
        :src="cover"
        :alt="title"
        width="1600"
        height="900"
        sizes="100vw sm:50vw lg:380px"
        format="avif"
        densities="1x"
        :loading="eager ? 'eager' : 'lazy'"
        :fetchpriority="eager ? 'high' : 'auto'"
        class="w-full h-auto aspect-[16/9] object-cover"
      />
      <div class="p-4">
        <h3 class="text-heading-md font-semibold">{{ title }}</h3>
        <p class="text-body-sm text-muted mt-1">{{ description }}</p>
        <time :datetime="pubDate" class="text-body-sm text-muted mt-2 block">
          {{ formatDate(pubDate, locale) }}
        </time>
      </div>
    </NuxtLink>
  </article>
</template>
