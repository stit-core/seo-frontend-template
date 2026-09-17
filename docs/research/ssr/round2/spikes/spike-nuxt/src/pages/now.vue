<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAsyncData, useSeoMeta } from '#imports'

const { t } = useI18n()

// Значение обязано вычисляться на каждый запрос — это и есть доказательство SSR.
const { data: serverTime } = await useAsyncData('now', async () => new Date().toISOString())

useSeoMeta({
  title: () => t('now.title'),
  description: () => t('now.description'),
  robots: 'noindex, follow',
})
</script>

<template>
  <section class="mx-auto max-w-5xl px-6 py-12">
    <h1 class="text-heading-xl font-bold">{{ t('now.title') }}</h1>
    <p class="text-body-md mt-4">
      {{ t('now.serverTime') }}: <code data-testid="server-time">{{ serverTime }}</code>
    </p>
  </section>
</template>
