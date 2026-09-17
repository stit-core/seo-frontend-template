import { getViteConfig } from 'astro/config'

export default getViteConfig({
  test: {
    globals: true,
    projects: [
      {
        // .astro-компоненты рендерятся Container API только в node-окружении:
        // в браузерных условиях astro-плагин отдаёт заглушку-ошибку.
        extends: true,
        test: { name: 'astro', environment: 'node', include: ['src/**/*.astro.test.ts', 'src/**/*.server.test.ts'] },
      },
      {
        extends: true,
        test: { name: 'dom', environment: 'happy-dom', include: ['src/**/*.test.ts'], exclude: ['src/**/*.astro.test.ts', 'src/**/*.server.test.ts'] },
      },
    ],
  },
})
