<script setup lang="ts">
import { PostCard } from '@/entities/post'

interface Item {
  path: string
  title: string
  description: string
  pubDate: string
  cover: string
}

defineProps<{ items: Item[]; locale: string }>()
</script>

<template>
  <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
    <PostCard
      v-for="(item, index) in items"
      :key="item.path"
      :path="item.path"
      :title="item.title"
      :description="item.description"
      :pub-date="item.pubDate"
      :cover="item.cover"
      :locale="locale"
      :eager="index === 0"
    />
  </div>
</template>
