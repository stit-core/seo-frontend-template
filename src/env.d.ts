// Типы .astro-модулей для plain-TS программ (tsc, typed-lint ESLint): Astro объявляет их
// только в своём language server (astro check, dev), а не в astro/client.
declare module '*.astro' {
  import type { AstroComponentFactory } from 'astro/runtime/server/index.js'

  const component: AstroComponentFactory
  export default component
}

// Данные репозитория (content/*.yaml) как модули: разобраны на сборке плагином yaml-modules
// из astro.config.ts; форму проверяет Zod в месте импорта (shared/redirects).
declare module '*.yaml' {
  const data: unknown
  export default data
}
