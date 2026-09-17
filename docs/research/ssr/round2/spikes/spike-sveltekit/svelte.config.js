import adapter from '@sveltejs/adapter-node'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import { mdsvex } from 'mdsvex'

/** @type {import('@sveltejs/kit').Config} */
const config = {
  extensions: ['.svelte', '.md'],

  preprocess: [vitePreprocess(), mdsvex({ extensions: ['.md'] })],

  kit: {
    // precompress у adapter-node — общий флаг для client и prerendered.
    // При C entrypoint штампует origin в .html и удаляет устаревшие .html.br/.gz;
    // ассеты остаются предсжатыми.
    adapter: adapter({ out: 'build', precompress: true }),

    // FSD-раскладка: маршруты в src/pages, $lib == слой shared,
    // документ-шелл и хуки — в слое app.
    files: {
      routes: 'src/pages',
      lib: 'src/shared',
      appTemplate: 'src/app/app.html',
      errorTemplate: 'src/app/error.html',
      hooks: {
        server: 'src/app/hooks.server',
        client: 'src/app/hooks.client',
        universal: 'src/app/hooks',
      },
      params: 'src/app/params',
      assets: 'static',
    },

    alias: {
      '@': 'src',
      '@/*': 'src/*',
    },

    prerender: {
      // Кроулер стартует со всех статических роутов; /en/* добавляем явно,
      // потому что reroute снимает префикс и ссылки на них локализуются рантаймом.
      entries: ['*', '/en', '/en/blog', '/en/about', '/en/contact/spasibo'],
      handleHttpError: 'fail',
    },

    typescript: {
      config: (c) => {
        c.include = [
          ...(c.include ?? []),
          '../*.config.ts',
          '../scripts/**/*',
          '../e2e/**/*',
          '../vitest-setup.d.ts',
        ]
        return c
      },
    },
  },
}

export default config
