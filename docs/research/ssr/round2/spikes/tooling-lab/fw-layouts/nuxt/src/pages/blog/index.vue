<script setup lang="ts">
import { PostList } from '@/widgets/post-list'
import type { Post } from '@/entities/post/model/schema'
const p: Post[] = []
</script>
<template><PostList />{{ p.length }}</template>
