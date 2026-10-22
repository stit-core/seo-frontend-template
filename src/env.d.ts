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

// Данные репозитория (content/*.yaml, снимок strategy/, shared/seo/crawlers.yaml) как модули:
// разобраны на сборке плагином yaml-modules из astro.config.ts; форму проверяет Zod в месте импорта
// (shared/redirects, shared/strategy, shared/seo).
declare module '*.yaml' {
  const data: unknown
  export default data
}

// План и copy deck одной страницы strategy по её id (плагин yaml-modules из astro.config.ts): путь файла от корня
// снимка → данные; форму проверяет чтение (shared/strategy, `pageOf` и `templateOf`).
declare module 'virtual:strategy/*' {
  const files: Readonly<Record<string, unknown>>
  export default files
}

// Что читает у политики ПДн ссылка согласия формы — проекция документа по его id (плагин yaml-modules, `consentOf`
// shared/strategy/contract.ts); форму проверяет чтение (`policyOf`).
declare module 'virtual:strategy/consent/*' {
  const consent: unknown
  export default consent
}

// `sizes` картинки по ширине контейнера секции: его выводит сборка из ролей файла токенов (плагин
// slot-sizes из astro.config.ts, разбор — shared/ui/section/sizes.ts).
declare module 'virtual:slot-sizes' {
  const sizes: Readonly<Record<'reading' | 'page' | 'wide' | 'full', string>>
  export default sizes
}

// Ленивая загрузка ролика — атрибут `loading` у <video> (Chromium): в типах разметки Astro его пока нет.
declare namespace astroHTML.JSX {
  interface VideoHTMLAttributes {
    loading?: 'eager' | 'lazy' | undefined | null
  }
}
