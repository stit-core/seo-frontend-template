const pkgs = [
  'eslint','typescript-eslint','@typescript-eslint/parser','eslint-plugin-astro','astro-eslint-parser',
  'eslint-plugin-svelte','svelte-eslint-parser','eslint-plugin-vue','vue-eslint-parser','@nuxt/eslint',
  'eslint-plugin-vuejs-accessibility','eslint-plugin-boundaries','eslint-plugin-import-x','eslint-plugin-jsx-a11y',
  'eslint-plugin-react-hooks','@biomejs/biome','steiger','@feature-sliced/steiger-plugin','dependency-cruiser','knip',
  'vitest','@vitest/browser','vitest-browser-svelte','vitest-browser-vue','vitest-axe','@playwright/test','size-limit','@size-limit/file',
  'happy-dom','@testing-library/svelte','@vue/test-utils','@nuxt/test-utils','astro','svelte','vue','nuxt','@sveltejs/kit',
  'svelte-check','vue-tsc','typescript','lefthook','@commitlint/cli','prettier','prettier-plugin-svelte','prettier-plugin-astro',
  'eslint-plugin-svelte-a11y','@astrojs/check','vitest-browser-astro','@vitest/coverage-v8','jsdom'
]
const out = []
await Promise.all(pkgs.map(async (p) => {
  try {
    const r = await fetch(`https://registry.npmjs.org/${encodeURIComponent(p).replace('%40','@')}`)
    if (!r.ok) { out.push([p, `HTTP ${r.status}`, '', '']); return }
    const j = await r.json()
    const latest = j['dist-tags']?.latest
    const v = j.versions?.[latest] ?? {}
    const time = j.time?.[latest]
    const peers = JSON.stringify(v.peerDependencies ?? {})
    out.push([p, latest, (time||'').slice(0,10), peers, JSON.stringify(v.engines ?? {})])
  } catch (e) { out.push([p, 'ERR ' + e.message, '', '']) }
}))
out.sort((a,b)=>a[0].localeCompare(b[0]))
for (const r of out) console.log(r.join(' | '))
