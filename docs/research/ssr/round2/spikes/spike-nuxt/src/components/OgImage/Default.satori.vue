<script setup lang="ts">
// Каталог src/components/OgImage/ навязан nuxt-og-image: он ищет шаблоны только там.
withDefaults(defineProps<{ title?: string; description?: string }>(), {
  title: 'stit demo',
  description: '',
})
</script>

<template>
  <div
    style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;padding:80px;background:#09090b;color:#fafafa"
  >
    <div style="display:flex;font-size:28px;color:#a1a1aa">stit demo</div>
    <div style="display:flex;font-size:64px;font-weight:700;margin-top:24px;line-height:1.1">
      {{ title }}
    </div>
    <div v-if="description" style="display:flex;font-size:30px;color:#d4d4d8;margin-top:24px">
      {{ description }}
    </div>
  </div>
</template>
