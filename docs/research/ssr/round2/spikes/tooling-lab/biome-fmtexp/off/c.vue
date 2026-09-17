<script setup lang="ts">
  import { cn } from '@/shared/lib'
  const x = 1
  let unused = 2
</script>
<template>
  <div    :class="cn('a')">
     <p>{{ x }}</p>
  </div>
</template>
<style>
.a    { color:   red; }
</style>
