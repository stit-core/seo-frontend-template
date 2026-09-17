import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

const prerenderHome = process.env.SPIKE_PRERENDER === '1'

export default defineConfig({
  resolve: {
    // Vite 8: встроенный резолв paths из tsconfig (@/* → src/*)
    tsconfigPaths: true,
  },

  plugins: [
    tanstackStart({
      srcDirectory: 'src',
      // routesDirectory / generatedRouteTree резолвятся ОТНОСИТЕЛЬНО srcDirectory
      router: {
        entry: './app/router/index.tsx',
        routesDirectory: 'pages',
        generatedRouteTree: 'app/router/routeTree.gen.ts',
        routeFileIgnorePrefix: '-',
      },
      start: { entry: './app/start.ts' },
      client: { entry: './app/client.tsx' },
      server: { entry: './app/server.ts' },

      sitemap: { enabled: true, host: 'https://example.com' },

      ...(prerenderHome
        ? {
            prerender: { enabled: true, crawlLinks: false, autoStaticPathsDiscovery: false },
            pages: [{ path: '/', prerender: { enabled: true } }],
          }
        : {}),
    }),
    // Nitro даёт запускаемый Node-сервер .output/server/index.mjs;
    // без него vite build отдаёт только fetch-энтри dist/server/server.js.
    nitro(),
    // react-плагин обязан идти ПОСЛЕ tanstackStart
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler', { compilationMode: 'infer' }]],
      },
    }),
    tailwindcss(),
  ],
})
