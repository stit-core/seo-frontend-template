<script setup lang="ts">
import { useLocaleHead } from '#i18n'
import { useHead } from '#imports'
import { SiteFooter } from '@/widgets/site-footer'
import { SiteHeader } from '@/widgets/site-header'

// lang/dir + hreflang + og:locale приезжают из i18n, а не пишутся руками.
const localeHead = useLocaleHead({ dir: true, lang: true, seo: true })

useHead(localeHead)
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <SiteHeader />
    <main class="flex-1">
      <slot />
    </main>
    <SiteFooter />
  </div>
</template>
