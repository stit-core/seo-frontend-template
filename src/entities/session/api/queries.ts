import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError, apiClient } from '@/shared/api'
import { type Session, SessionSchema } from '../model/schema'

export const sessionQueryKey = ['session'] as const

export const sessionQueryOptions = queryOptions({
  queryKey: sessionQueryKey,
  queryFn: async (): Promise<Session | null> => {
    try {
      return SessionSchema.parse(await apiClient.get('/v1/session'))
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null
      throw error
    }
  },
  staleTime: 60_000,
})

export function useLogoutMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/v1/auth/logout')
    },
    onSuccess: () => {
      qc.setQueryData(sessionQueryKey, null)
      void qc.invalidateQueries()
    },
  })
}
