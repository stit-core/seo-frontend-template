import { useQuery } from '@tanstack/react-query'
import { sessionQueryOptions } from '../api/queries'
import type { Session } from '../model/schema'

interface UseSessionResult {
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
}

export function useSession(): UseSessionResult {
  const { data, isLoading } = useQuery(sessionQueryOptions)
  return {
    session: data ?? null,
    isLoading,
    isAuthenticated: data != null,
  }
}
