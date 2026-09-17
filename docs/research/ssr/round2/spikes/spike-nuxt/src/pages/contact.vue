<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useSeoMeta } from '#imports'
import { ContactForm } from '@/features/contact-form'

const { t } = useI18n()

useSeoMeta({
  title: () => t('contact.title'),
  description: () => t('contact.description'),
  robots: 'noindex, follow',
})
</script>

<template>
  <section class="mx-auto max-w-5xl px-6 py-12">
    <h1 class="text-heading-xl font-bold">{{ t('contact.title') }}</h1>
    <p class="text-body-md text-muted mt-3">{{ t('contact.description') }}</p>
    <ContactForm />
  </section>
</template>
