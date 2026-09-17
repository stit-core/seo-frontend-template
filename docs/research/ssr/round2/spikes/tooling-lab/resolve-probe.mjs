import ts from 'typescript'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const importer = path.join(root, 'src/widgets/hero/ui/hero.astro')

const base = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  baseUrl: root,
  paths: { '@/*': [path.join(root, 'src/*')] },
}

const variants = {
  'bundler (как в шаблоне)': base,
  'bundler + allowJs': { ...base, allowJs: true },
  'bundler + allowArbitraryExtensions': { ...base, allowArbitraryExtensions: true },
  'node16': { ...base, module: ts.ModuleKind.Node16, moduleResolution: ts.ModuleResolutionKind.Node16 },
}

const specs = [
  '@/entities/post',                       // index.ts — контроль
  '@/entities/post/ui/post-card.astro',
  '@/entities/post/ui/post-card.svelte',
  '@/entities/post/ui/PostCard.vue',
  '../../../entities/post/ui/post-card.astro',
  '@/entities/post/ui/post-card',          // без расширения
]

for (const [name, opts] of Object.entries(variants)) {
  console.log(`\n### ${name}`)
  for (const spec of specs) {
    const r = ts.resolveModuleName(spec, importer, opts, { ...ts.sys, fileExists: fs.existsSync, directoryExists: (p) => fs.existsSync(p) && fs.statSync(p).isDirectory() })
    const f = r.resolvedModule?.resolvedFileName
    console.log(`  ${spec.padEnd(46)} -> ${f ? path.relative(root, f) : 'NULL'}`)
  }
}

// какие кандидаты TS вообще пробует
console.log('\n### trace кандидатов для ./post-card.svelte')
const r = ts.resolveModuleName('./post-card.svelte', path.join(root, 'src/entities/post/ui/x.ts'), { ...base, traceResolution: true }, { ...ts.sys, fileExists: fs.existsSync, directoryExists: (p) => fs.existsSync(p) && fs.statSync(p).isDirectory(), trace: (m) => { if (/File .* (does not exist|exist)/.test(m)) console.log('   ' + m) } })
console.log('  resolved:', r.resolvedModule?.resolvedFileName ?? 'NULL')
