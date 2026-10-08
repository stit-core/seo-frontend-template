// Типы .astro-модулей для plain-TS программ (tsc, typed-lint ESLint): Astro объявляет их
// только в своём language server (astro check, dev), а не в astro/client.
declare module '*.astro' {
  import type { AstroComponentFactory } from 'astro/runtime/server/index.js'

  const component: AstroComponentFactory
  export default component
}

// Locals запроса: on-demand маршруты берут отсюда идентификатор запроса для своих
// событий — тот же, что middleware отдаёт заголовком X-Request-Id.
declare namespace App {
  interface Locals {
    rid: string
  }
}

// Данные репозитория (content/*.yaml, shared/seo/crawlers.yaml) как модули: разобраны на сборке
// плагином yaml-modules из astro.config.ts; форму проверяет Zod в месте импорта (shared/redirects,
// shared/seo).
declare module '*.yaml' {
  const data: unknown
  export default data
}
