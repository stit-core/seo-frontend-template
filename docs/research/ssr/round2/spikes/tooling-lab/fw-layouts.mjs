import fs from 'node:fs'
import path from 'node:path'
const root = path.join(path.dirname(new URL(import.meta.url).pathname), 'fw-layouts')
fs.rmSync(root, { recursive: true, force: true })
const w = (p, c) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c) }

const tsconfig = `{
  "compilerOptions": {
    "target": "ES2024", "module": "ESNext", "moduleResolution": "bundler",
    "strict": true, "noEmit": true, "verbatimModuleSyntax": true,
    "baseUrl": ".", "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}`
const steigerBase = `import fsd from '@feature-sliced/steiger-plugin'
import { defineConfig } from 'steiger'
export default defineConfig([...fsd.configs.recommended])
`

// ---------- ASTRO B: srcDir по умолчанию, pages = слой FSD ----------
{
  const b = path.join(root, 'astro-b')
  w(`${b}/tsconfig.json`, tsconfig)
  w(`${b}/steiger.config.ts`, steigerBase)
  // навязанные фреймворком файлы
  w(`${b}/src/content.config.ts`, `import { defineCollection } from 'astro:content'\nexport const collections = {}\n`)
  w(`${b}/src/middleware.ts`, `export const onRequest = (_c: unknown, next: () => unknown) => next()\n`)
  w(`${b}/src/actions/index.ts`, `export const server = {}\n`)
  w(`${b}/src/env.d.ts`, `/// <reference types="astro/client" />\n`)
  // маршруты
  w(`${b}/src/pages/index.astro`, `---\nimport { Hero } from '@/widgets/hero'\n---\n<Hero />\n`)
  w(`${b}/src/pages/404.astro`, `---\nconst t = '404'\n---\n<p>{t}</p>\n`)
  w(`${b}/src/pages/blog/index.astro`, `---\nimport { PostList } from '@/widgets/post-list'\n---\n<PostList />\n`)
  w(`${b}/src/pages/blog/[slug].astro`, `---\nimport { PostArticle } from '@/widgets/post-article'\n---\n<PostArticle />\n`)
  w(`${b}/src/pages/robots.txt.ts`, `export const GET = () => new Response('User-agent: *\\n')\n`)
  w(`${b}/src/pages/en/index.astro`, `---\nimport { Hero } from '@/widgets/hero'\n---\n<Hero />\n`)
  w(`${b}/src/pages/_components/section.astro`, `---\nconst x = 1\n---\n<i>{x}</i>\n`)
  // слои
  w(`${b}/src/widgets/hero/ui/hero.astro`, `---\nimport { seo } from '@/shared/seo'\n---\n<h1>{seo.title}</h1>\n`)
  w(`${b}/src/widgets/hero/index.ts`, `export { default as Hero } from './ui/hero.astro'\n`)
  w(`${b}/src/widgets/post-list/ui/post-list.astro`, `---\nimport { PostCard } from '@/entities/post'\n---\n<PostCard />\n`)
  w(`${b}/src/widgets/post-list/index.ts`, `export { default as PostList } from './ui/post-list.astro'\n`)
  w(`${b}/src/widgets/post-article/ui/post-article.astro`, `---\nimport { PostCard } from '@/entities/post'\n---\n<PostCard />\n`)
  w(`${b}/src/widgets/post-article/index.ts`, `export { default as PostArticle } from './ui/post-article.astro'\n`)
  w(`${b}/src/entities/post/model/schema.ts`, `import { z } from 'zod'\nexport const PostSchema = z.object({ title: z.string() })\n`)
  w(`${b}/src/entities/post/ui/post-card.astro`, `---\nconst x = 1\n---\n<i>{x}</i>\n`)
  w(`${b}/src/entities/post/content/a.md`, `---\ntitle: a\n---\nтекст\n`)
  w(`${b}/src/entities/post/index.ts`, `export { PostSchema } from './model/schema'\nexport { default as PostCard } from './ui/post-card.astro'\n`)
  w(`${b}/src/shared/seo/index.ts`, `export const seo = { title: 'stit' }\n`)
  w(`${b}/src/shared/ui/button/button.astro`, `---\nconst x = 1\n---\n<button>{x}</button>\n`)
  w(`${b}/src/shared/ui/button/index.ts`, `export { default as Button } from './button.astro'\n`)
  w(`${b}/src/app/styles/index.css`, `:root { --x: 1 }\n`)
}

// ---------- SVELTEKIT: routes навязан ----------
{
  const b = path.join(root, 'sveltekit')
  w(`${b}/tsconfig.json`, tsconfig)
  w(`${b}/steiger.config.ts`, steigerBase)
  w(`${b}/src/app.html`, `<!doctype html><html %sveltekit.head%></html>\n`)
  w(`${b}/src/app.d.ts`, `declare global {}\nexport {}\n`)
  w(`${b}/src/hooks.server.ts`, `export const handle = async ({ event, resolve }: any) => resolve(event)\n`)
  w(`${b}/src/routes/+layout.svelte`, `<script lang="ts">\n  let { children } = $props()\n</script>\n{@render children()}\n`)
  w(`${b}/src/routes/+page.svelte`, `<script lang="ts">\n  import { Hero } from '@/widgets/hero'\n</script>\n<Hero />\n`)
  w(`${b}/src/routes/blog/+page.server.ts`, `export const load = () => ({ posts: [] })\n`)
  w(`${b}/src/routes/blog/[slug]/+page.svelte`, `<script lang="ts">\n  import { PostArticle } from '@/widgets/post-article'\n</script>\n<PostArticle />\n`)
  w(`${b}/src/routes/robots.txt/+server.ts`, `export const GET = () => new Response('')\n`)
  w(`${b}/src/lib/index.ts`, `export const lib = 1\n`)
  w(`${b}/src/widgets/hero/ui/hero.svelte`, `<script lang="ts">\n  import { seo } from '@/shared/seo'\n</script>\n<h1>{seo.title}</h1>\n`)
  w(`${b}/src/widgets/hero/index.ts`, `export { default as Hero } from './ui/hero.svelte'\n`)
  w(`${b}/src/widgets/post-article/ui/post-article.svelte`, `<script lang="ts">\n  import { PostCard } from '@/entities/post'\n</script>\n<PostCard />\n`)
  w(`${b}/src/widgets/post-article/index.ts`, `export { default as PostArticle } from './ui/post-article.svelte'\n`)
  w(`${b}/src/entities/post/model/schema.ts`, `export type Post = { title: string }\n`)
  w(`${b}/src/entities/post/ui/post-card.svelte`, `<script lang="ts">let x = 1</script>\n<i>{x}</i>\n`)
  w(`${b}/src/entities/post/index.ts`, `export type { Post } from './model/schema'\nexport { default as PostCard } from './ui/post-card.svelte'\n`)
  w(`${b}/src/shared/seo/index.ts`, `export const seo = { title: 'stit' }\n`)
  w(`${b}/src/app/styles/index.css`, `:root { --x: 1 }\n`)
}

// ---------- NUXT: srcDir=src, pages/, app.vue, error.vue ----------
{
  const b = path.join(root, 'nuxt')
  w(`${b}/tsconfig.json`, tsconfig)
  w(`${b}/steiger.config.ts`, steigerBase)
  w(`${b}/src/app.vue`, `<template><NuxtPage /></template>\n`)
  w(`${b}/src/error.vue`, `<script setup lang="ts">\ndefineProps<{ error: unknown }>()\n</script>\n<template><p>err</p></template>\n`)
  w(`${b}/src/pages/index.vue`, `<script setup lang="ts">\nimport { Hero } from '@/widgets/hero'\n</script>\n<template><Hero /></template>\n`)
  w(`${b}/src/pages/blog/index.vue`, `<script setup lang="ts">\nimport { PostList } from '@/widgets/post-list'\n</script>\n<template><PostList /></template>\n`)
  w(`${b}/src/pages/blog/[slug].vue`, `<script setup lang="ts">\nimport { PostArticle } from '@/widgets/post-article'\n</script>\n<template><PostArticle /></template>\n`)
  w(`${b}/src/widgets/hero/ui/Hero.vue`, `<script setup lang="ts">\nimport { seo } from '@/shared/seo'\n</script>\n<template><h1>{{ seo.title }}</h1></template>\n`)
  w(`${b}/src/widgets/hero/index.ts`, `export { default as Hero } from './ui/Hero.vue'\n`)
  w(`${b}/src/widgets/post-list/ui/PostList.vue`, `<script setup lang="ts">\nimport { PostCard } from '@/entities/post'\n</script>\n<template><PostCard /></template>\n`)
  w(`${b}/src/widgets/post-list/index.ts`, `export { default as PostList } from './ui/PostList.vue'\n`)
  w(`${b}/src/widgets/post-article/ui/PostArticle.vue`, `<script setup lang="ts">\nimport { PostCard } from '@/entities/post'\n</script>\n<template><PostCard /></template>\n`)
  w(`${b}/src/widgets/post-article/index.ts`, `export { default as PostArticle } from './ui/PostArticle.vue'\n`)
  w(`${b}/src/entities/post/model/schema.ts`, `export type Post = { title: string }\n`)
  w(`${b}/src/entities/post/ui/PostCard.vue`, `<script setup lang="ts">\nconst x = 1\n</script>\n<template><i>{{ x }}</i></template>\n`)
  w(`${b}/src/entities/post/index.ts`, `export type { Post } from './model/schema'\nexport { default as PostCard } from './ui/PostCard.vue'\n`)
  w(`${b}/src/shared/seo/index.ts`, `export const seo = { title: 'stit' }\n`)
  w(`${b}/src/app/styles/index.css`, `:root { --x: 1 }\n`)
}
console.log('ok')
