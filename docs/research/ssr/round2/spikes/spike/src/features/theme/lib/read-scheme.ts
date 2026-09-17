import { createIsomorphicFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'

export type Scheme = 'light' | 'dark'

function normalize(value: string | undefined): Scheme {
  return value === 'dark' ? 'dark' : 'light'
}

// Тема должна попасть в первый же HTML, иначе будет вспышка светлой темы
// и рассинхрон при гидрации. Источник — cookie, не localStorage.
export const readScheme = createIsomorphicFn()
  .server((): Scheme => normalize(getCookie('scheme')))
  .client((): Scheme => normalize(document.cookie.match(/(?:^|; )scheme=([^;]*)/)?.[1]))
