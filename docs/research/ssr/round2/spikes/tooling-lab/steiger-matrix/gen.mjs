import fs from 'node:fs'
import path from 'node:path'

const root = path.dirname(new URL(import.meta.url).pathname)
const src = path.join(root, 'src')
fs.rmSync(src, { recursive: true, force: true })

const w = (p, c) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c) }

// ---- нижние слои (мишени импортов) ----
w(`${src}/shared/lib/cn.ts`, `export const cn = (...p: string[]) => p.join(' ')\n`)
w(`${src}/shared/lib/index.ts`, `export { cn } from './cn'\n`)

w(`${src}/entities/post/model/schema.ts`, `export type Post = { slug: string }\n`)
w(`${src}/entities/post/ui/card.astro`, `---\nconst { t } = Astro.props as { t: string }\n---\n<div>{t}</div>\n`)
w(`${src}/entities/post/ui/card.svelte`, `<script lang="ts">\n  let { t = '' }: { t?: string } = $props()\n</script>\n<div>{t}</div>\n`)
w(`${src}/entities/post/ui/Card.vue`, `<script setup lang="ts">\ndefineProps<{ t?: string }>()\n</script>\n<template><div>{{ t }}</div></template>\n`)
w(`${src}/entities/post/ui/card.tsx`, `export const Card = () => null\n`)
w(`${src}/entities/post/index.ts`, `export type { Post } from './model/schema'\nexport { Card } from './ui/card.tsx'\n`)

w(`${src}/widgets/hero/ui/hero.ts`, `export const hero = 'hero'\n`)
w(`${src}/widgets/hero/index.ts`, `export { hero } from './ui/hero'\n`)

// слайс-жертва для cross-slice
w(`${src}/features/victim/model/data.ts`, `export const victim = 1\n`)
w(`${src}/features/victim/ui/thing.svelte`, `<script lang="ts">let x = 1</script>\n<i>{x}</i>\n`)
w(`${src}/features/victim/index.ts`, `export { victim } from './model/data'\n`)

// ---- матрица источников ----
// каждый кейс = один файл с ровно одним импортом
const cases = [
  ['v1_cross_slice_index',   `@/features/victim`,                  'forbidden-imports (cross-slice, target .ts index)'],
  ['v2_deep_ts',             `@/entities/post/model/schema`,       'no-public-api-sidestep (target .ts)'],
  ['v3_deep_astro',          `@/entities/post/ui/card.astro`,      'no-public-api-sidestep (target .astro)'],
  ['v4_deep_svelte',         `@/entities/post/ui/card.svelte`,     'no-public-api-sidestep (target .svelte)'],
  ['v5_deep_vue',            `@/entities/post/ui/Card.vue`,        'no-public-api-sidestep (target .vue)'],
  ['v6_upward_index',        `@/widgets/hero`,                     'forbidden-imports (higher layer, target .ts index)'],
  ['v7_rel_cross_svelte',    `../../victim/ui/thing.svelte`,       'cross-slice относительным путём в .svelte'],
  ['v8_deep_tsx',            `@/entities/post/ui/card.tsx`,        'no-public-api-sidestep (target .tsx с расширением)'],
  ['v9_dynamic_deep_ts',     `@/entities/post/model/schema`,       'динамический import() deep .ts'],
]

const bodyFor = {
  ts:        (spec, dyn) => dyn ? `export const load = () => import('${spec}')\n` : `import '${spec}'\nexport const x = 1\n`,
  mts:       (spec, dyn) => dyn ? `export const load = () => import('${spec}')\n` : `import '${spec}'\nexport const x = 1\n`,
  cts:       (spec, dyn) => dyn ? `export const load = () => import('${spec}')\n` : `import '${spec}'\nexport const x = 1\n`,
  tsx:       (spec, dyn) => dyn ? `export const load = () => import('${spec}')\n` : `import '${spec}'\nexport const X = () => null\n`,
  astroFm:   (spec, dyn) => `---\n${dyn ? `const p = import('${spec}')` : `import '${spec}'`}\n---\n<p>astro-frontmatter</p>\n`,
  astroCli:  (spec, dyn) => `---\nconst a = 1\n---\n<p>{a}</p>\n<script>\n  ${dyn ? `import('${spec}')` : `import '${spec}'`}\n</script>\n`,
  svelteIn:  (spec, dyn) => `<script lang="ts">\n  ${dyn ? `const p = import('${spec}')` : `import '${spec}'`}\n</script>\n<i>svelte-instance</i>\n`,
  svelteMod: (spec, dyn) => `<script module lang="ts">\n  ${dyn ? `const p = import('${spec}')` : `import '${spec}'`}\n</script>\n<script lang="ts">let y = 1</script>\n<i>{y}</i>\n`,
  vueSetup:  (spec, dyn) => `<script setup lang="ts">\n${dyn ? `const p = import('${spec}')` : `import '${spec}'`}\n</script>\n<template><i>vue-setup</i></template>\n`,
  vuePlain:  (spec, dyn) => `<script lang="ts">\n${dyn ? `const p = import('${spec}')` : `import '${spec}'`}\nexport default { name: 'VuePlain' }\n</script>\n<template><i>vue-plain</i></template>\n`,
}

const sources = [
  ['s-ts',         'ts',        (n) => `${n}.ts`],
  ['s-mts',        'mts',       (n) => `${n}.mts`],
  ['s-cts',        'cts',       (n) => `${n}.cts`],
  ['s-tsx',        'tsx',       (n) => `${n}.tsx`],
  ['s-astro-fm',   'astroFm',   (n) => `${n}.astro`],
  ['s-astro-cli',  'astroCli',  (n) => `${n}.astro`],
  ['s-svelte-in',  'svelteIn',  (n) => `${n}.svelte`],
  ['s-svelte-mod', 'svelteMod', (n) => `${n}.svelte`],
  ['s-vue-setup',  'vueSetup',  (n) => `${n}.vue`],
  ['s-vue-plain',  'vuePlain',  (n) => `${n}.vue`],
]

for (const [slice, kind, nameFn] of sources) {
  for (const [caseName, spec] of cases) {
    const dyn = caseName.startsWith('v9')
    w(path.join(src, 'features', slice, 'ui', nameFn(caseName)), bodyFor[kind](spec, dyn))
  }
  w(path.join(src, 'features', slice, 'index.ts'), `export const ${slice.replace(/-/g, '_')} = 1\n`)
}

// ---- (е) index.<framework> как public API ----
w(`${src}/features/pub-svelte/ui/inner.ts`, `export const inner = 1\n`)
w(`${src}/features/pub-svelte/index.svelte`, `<script lang="ts">\n  import { inner } from './ui/inner'\n</script>\n<i>{inner}</i>\n`)
w(`${src}/features/pub-vue/ui/inner.ts`, `export const inner = 1\n`)
w(`${src}/features/pub-vue/index.vue`, `<script setup lang="ts">\nimport { inner } from './ui/inner'\n</script>\n<template><i>{{ inner }}</i></template>\n`)
w(`${src}/features/pub-astro/ui/inner.ts`, `export const inner = 1\n`)
w(`${src}/features/pub-astro/index.astro`, `---\nimport { inner } from './ui/inner'\n---\n<i>{inner}</i>\n`)
// слайс вообще без index
w(`${src}/features/no-index/ui/a.svelte`, `<script lang="ts">let z = 1</script>\n<i>{z}</i>\n`)

// потребитель index.<framework> — резолвится ли алиас на каталог с index.svelte
w(`${src}/pages/consumer.ts`, `import '@/features/pub-svelte'\nimport '@/features/pub-vue'\nimport '@/features/pub-astro'\nexport const c = 1\n`)

console.log('generated')
