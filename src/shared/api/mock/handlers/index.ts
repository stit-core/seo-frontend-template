import type { DB } from '../db'
import { authHandlers } from './auth'
import { errorHandlers } from './error'
import { todoHandlers } from './todos'
import { userHandlers } from './users'

export function buildHandlers(db: DB, errorMode: boolean) {
  if (errorMode) return errorHandlers()
  return [...authHandlers(db), ...userHandlers(db), ...todoHandlers(db)]
}
