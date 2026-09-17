<script setup lang="ts">
import { NuxtLink } from '#components'

defineProps<{ title: string; lead: string; cta: string; ctaHref: string }>()
</script>

<template>
  <section class="mx-auto max-w-5xl px-6 pt-12 pb-8">
    <h1 class="text-heading-xl font-bold tracking-tight">{{ title }}</h1>
    <p class="text-body-md text-muted mt-4 max-w-2xl">{{ lead }}</p>
    <NuxtLink
      :to="ctaHref"
      class="mt-6 inline-block rounded-control bg-action-bg px-5 py-2.5 text-action-ink text-body-sm font-medium"
    >
      {{ cta }}
    </NuxtLink>
  </section>
</template>
