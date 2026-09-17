import { qwikVite } from '@qwik.dev/core/optimizer'
import { qwikRouter } from '@qwik.dev/router/vite'
import { defineConfig } from 'vite'
export default defineConfig({ plugins: [qwikRouter(), qwikVite()] })
