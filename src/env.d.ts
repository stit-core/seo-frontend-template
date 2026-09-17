// Типы .astro-модулей для plain-TS программ (tsc, typed-lint ESLint): Astro объявляет их
// только в своём language server (astro check, dev), а не в astro/client.
declare module '*.astro' {
  import type { AstroComponentFactory } from 'astro/runtime/server/index.js'

  const component: AstroComponentFactory
  export default component
}
