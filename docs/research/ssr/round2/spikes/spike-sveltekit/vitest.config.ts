import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: { __RENDER_MODE__: JSON.stringify('A') },
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  plugins: [svelte(), svelteTesting()],
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,svelte.ts}'],
  },
})
