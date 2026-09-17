import * as astroParser from 'astro-eslint-parser'
import fs from 'node:fs'
const code = fs.readFileSync('src/entities/post/ui/post-meta.astro', 'utf8')
const res = astroParser.parseForESLint(code, { filePath: 'src/entities/post/ui/post-meta.astro' })
const body = res.ast.body
console.log('top-level узлы:', body.map((n) => n.type).join(', '))
const walk = (n, d = 0) => {
  if (!n || typeof n !== 'object') return
  if (n.type === 'ImportDeclaration') console.log('  '.repeat(d), 'IMPORT:', n.source.value)
  if (n.type === 'AstroRawText') console.log('  '.repeat(d), 'AstroRawText:', JSON.stringify(n.value).slice(0, 80))
  for (const k of Object.keys(n)) {
    if (k === 'parent') continue
    const v = n[k]
    if (Array.isArray(v)) v.forEach((c) => walk(c, d + 1))
    else if (v && typeof v === 'object' && typeof v.type === 'string') walk(v, d + 1)
  }
}
body.forEach((n) => walk(n))
