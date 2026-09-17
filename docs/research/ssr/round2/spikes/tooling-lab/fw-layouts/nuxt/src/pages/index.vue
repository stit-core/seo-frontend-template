<script setup lang="ts">
import { Hero } from '@/widgets/hero'
import type { Post } from '@/entities/post/model/schema'
const p: Post[] = []
</script>
<template><Hero />{{ p.length }}</template>
