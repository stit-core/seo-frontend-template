<script setup lang="ts">
withDefaults(defineProps<{ title?: string }>(), { title: 'заголовок' })
</script>

<template>
  <article>
    <h2>{{ title }}</h2>
    <img src="/cover.png" alt="обложка" />
  </article>
</template>
