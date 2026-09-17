import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { analyzer } from 'vite-bundle-analyzer'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_TARGET ?? 'http://localhost:8080'

  return {
    plugins: [
      // Роут-дерево генерится и здесь, и standalone через `pnpm gen`
      // (tsr читает tsr.config.json — держи оба конфига в синхроне).
      tanstackRouter({
        target: 'react',
        routesDirectory: 'src/pages',
        generatedRouteTree: 'src/app/router/routeTree.gen.ts',
        routeFileIgnorePrefix: '-',
      }),
      react({
        babel: {
          // infer: компилируются все компоненты/хуки; режим 'all' ломает
          // обычные функции (useMemoCache вне рендера, напр. в тест-хелперах).
          plugins: [['babel-plugin-react-compiler', { compilationMode: 'infer' }]],
        },
      }),
      tailwindcss(),
      mode === 'analyze' && analyzer(),
    ].filter(Boolean),

    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },

    server: {
      port: 5173,
      ...(env.VITE_API_MODE === 'real' && {
        proxy: {
          '/api': {
            target: apiTarget,
            changeOrigin: true,
            secure: false,
          },
        },
      }),
    },

    build: {
      target: 'es2024',
      sourcemap: true,
      // mock-чанк (MSW + @mswjs/data + faker) ~1.1MB — lazy, в prod не грузится.
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          // Rolldown-нарезка вендоров; бюджеты — .size-limit.cjs.
          codeSplitting: {
            groups: [
              { name: 'react', test: /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/ },
              {
                name: 'router',
                test: /node_modules[\\/]@tanstack[\\/](?:react-router|router-core|history)/,
              },
              { name: 'query', test: /node_modules[\\/]@tanstack[\\/](?:react-query|query-core)/ },
            ],
          },
        },
      },
    },
  }
})
