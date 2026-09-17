<script setup lang="ts">
  withDefaults(defineProps<{ title: string; tags?: string[] }>(), { tags: () => [] })
</script>

<template>
  <article>
    <h3 v-if="title">{{ title }}</h3>
    <ul>
      <li v-for="t in tags" :key="t">{{ t }}</li>
    </ul>
    <slot name="footer" />
    <img src="/x.png">
  </article>
</template>
