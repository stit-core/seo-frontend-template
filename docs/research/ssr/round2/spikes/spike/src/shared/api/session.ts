import { createIsomorphicFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'

export const readSession = createIsomorphicFn()
  .server((): string | undefined => getCookie('app_session'))
  .client((): string | undefined => document.cookie.match(/(?:^|; )app_session=([^;]*)/)?.[1])
