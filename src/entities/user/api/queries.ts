import { queryOptions } from '@tanstack/react-query'
import { apiClient } from '@/shared/api'
import { type User, UserSchema } from '../model/schema'

export const userQueryKey = (id: string) => ['user', id] as const

export function userQueryOptions(id: string) {
  return queryOptions({
    queryKey: userQueryKey(id),
    queryFn: async (): Promise<User> => UserSchema.parse(await apiClient.get(`/v1/users/${id}`)),
  })
}
