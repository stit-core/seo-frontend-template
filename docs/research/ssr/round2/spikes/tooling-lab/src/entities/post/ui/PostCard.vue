<script setup lang="ts">
import type { Author } from '@/entities/author'
import { Hero } from '@/widgets/hero'
import { cn } from '@/shared/lib'
defineProps<{ title: string }>()
const author: Author = { slug: 'a', name: 'A' }
</script>

<template>
  <article :class="cn('post-card')">
    <h2>{{ title }}</h2>
    <p>{{ author.name }}</p>
    <Hero />
  </article>
</template>
