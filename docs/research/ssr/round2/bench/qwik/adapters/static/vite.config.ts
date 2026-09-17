import { staticAdapter } from '@qwik.dev/router/adapters/static/vite'
import { extendConfig } from '@qwik.dev/router/vite'
import baseConfig from '../../vite.config'

export default extendConfig(baseConfig, () => ({
  build: { ssr: true, rollupOptions: { input: ['src/entry.ssr.tsx', '@qwik-router-config'] } },
  plugins: [staticAdapter({ origin: 'http://127.0.0.1:3208' })],
}))
