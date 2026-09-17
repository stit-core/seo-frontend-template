import { useMutation, useQueryClient } from '@tanstack/react-query'
import { SessionSchema, sessionQueryKey } from '@/entities/session'
import { ApiError, apiClient } from '@/shared/api'
import type { LoginInput } from '../model/schema'

export function useLoginMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      try {
        return SessionSchema.parse(await apiClient.post('/v1/auth/login', { body: input }))
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          throw new Error('Неверный email или пароль', { cause: error })
        }
        throw error
      }
    },
    onSuccess: (session) => {
      qc.setQueryData(sessionQueryKey, session)
      void qc.invalidateQueries()
    },
  })
}
