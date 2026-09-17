import { paraglideVitePlugin } from '@inlang/paraglide-js'
import { enhancedImages } from '@sveltejs/enhanced-img'
import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Режим рендера фиксируется на сборке: A/C пререндерят контент, D рендерит на запрос.
const renderMode = process.env.SITE_RENDER_MODE ?? 'A'

export default defineConfig({
  define: {
    __RENDER_MODE__: JSON.stringify(renderMode),
  },

  plugins: [
    // enhancedImages обязан идти ДО sveltekit
    enhancedImages(),
    tailwindcss(),
    sveltekit(),
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/shared/i18n/paraglide',
      strategy: ['url', 'baseLocale'],
      // Без этого localizeHref('/', { locale: 'en' }) даёт '/en/' — лишний 308.
      trailingSlash: 'never',
      emitTsDeclarations: true,
    }),
  ],
})
