<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from '#imports'

const { t } = useI18n()
const route = useRoute()

// ?sent=1 приходит после нативного POST без JS — 303 от server/api/contact.post.ts
const state = ref<'idle' | 'sending' | 'done' | 'error'>(route.query.sent ? 'done' : 'idle')
const name = ref('')
const email = ref('')
const message = ref('')
// honeypot: люди это поле не видят, боты — заполняют
const company = ref('')

async function submit() {
  state.value = 'sending'
  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: name.value,
        email: email.value,
        message: message.value,
        company: company.value,
      }),
    })
    state.value = response.ok ? 'done' : 'error'
  } catch {
    state.value = 'error'
  }
}
</script>

<template>
  <form
    v-if="state !== 'done'"
    class="mt-6 grid max-w-lg gap-4"
    method="post"
    action="/api/contact"
    @submit.prevent="submit"
  >
    <label class="grid gap-1 text-body-sm">
      <span>{{ t('contact.name') }}</span>
      <input
        v-model="name"
        name="name"
        required
        class="rounded-control border border-divider bg-canvas px-3 py-2"
      >
    </label>
    <label class="grid gap-1 text-body-sm">
      <span>{{ t('contact.email') }}</span>
      <input
        v-model="email"
        name="email"
        type="email"
        required
        class="rounded-control border border-divider bg-canvas px-3 py-2"
      >
    </label>
    <label class="grid gap-1 text-body-sm">
      <span>{{ t('contact.message') }}</span>
      <textarea
        v-model="message"
        name="message"
        rows="5"
        required
        class="rounded-control border border-divider bg-canvas px-3 py-2"
      />
    </label>
    <input
      v-model="company"
      name="company"
      tabindex="-1"
      autocomplete="off"
      aria-hidden="true"
      class="hidden"
    >
    <button
      type="submit"
      :disabled="state === 'sending'"
      class="rounded-control bg-action-bg px-5 py-2.5 text-action-ink text-body-sm font-medium"
    >
      {{ state === 'sending' ? t('contact.sending') : t('contact.submit') }}
    </button>
    <p v-if="state === 'error'" role="alert" class="text-body-sm">{{ t('contact.error') }}</p>
  </form>
  <p v-else role="status" class="mt-6 text-body-md">{{ t('contact.thanks') }}</p>
</template>
