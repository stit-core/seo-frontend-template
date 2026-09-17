<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { NuxtLink } from '#components'
import { useLocalePath, useSwitchLocalePath } from '#i18n'

const { t, locale } = useI18n()
const localePath = useLocalePath()
const switchLocalePath = useSwitchLocalePath()
</script>

<template>
  <header class="border-b border-divider">
    <nav class="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-6 py-4" aria-label="main">
      <NuxtLink :to="localePath('/')" class="font-semibold">stit demo</NuxtLink>
      <NuxtLink :to="localePath('/blog')" class="text-body-sm text-muted">{{
        t('nav.blog')
      }}</NuxtLink>
      <NuxtLink :to="localePath('/about')" class="text-body-sm text-muted">{{
        t('nav.about')
      }}</NuxtLink>
      <NuxtLink :to="localePath('/contact')" class="text-body-sm text-muted">{{
        t('nav.contact')
      }}</NuxtLink>
      <NuxtLink to="/now" class="text-body-sm text-muted">{{ t('nav.now') }}</NuxtLink>
      <span class="ml-auto text-body-sm">
        <NuxtLink v-if="locale === 'ru'" :to="switchLocalePath('en')" hreflang="en">EN</NuxtLink>
        <NuxtLink v-else :to="switchLocalePath('ru')" hreflang="ru">RU</NuxtLink>
      </span>
    </nav>
  </header>
</template>
