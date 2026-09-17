import { svelteTesting } from '@testing-library/svelte/vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // svelteTesting() выставляет resolve.conditions для браузерной сборки svelte:
  // иначе mount() падает с lifecycle_function_unavailable (резолвится server-бандл).
  plugins: [svelte(), vue(), svelteTesting()],
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
  },
})
