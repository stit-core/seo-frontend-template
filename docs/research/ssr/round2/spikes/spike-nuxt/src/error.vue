<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { NuxtError } from '#app'
import { NuxtLink } from '#components'
import { useHead } from '#imports'

const props = defineProps<{ error: NuxtError }>()
const { t } = useI18n()

useHead({
  title: props.error.statusCode === 404 ? t('error.notFoundTitle') : `${props.error.statusCode}`,
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})
</script>

<template>
  <main class="mx-auto max-w-5xl px-6 py-16">
    <h1 class="text-heading-lg font-semibold">
      {{
        error.statusCode === 404 ? t('error.notFoundTitle') : `${error.statusCode} — ${error.statusMessage}`
      }}
    </h1>
    <p class="text-body-md text-muted mt-3">{{ t('error.notFoundText') }}</p>
    <NuxtLink to="/" class="mt-6 inline-block underline">{{ t('error.home') }}</NuxtLink>
  </main>
</template>
