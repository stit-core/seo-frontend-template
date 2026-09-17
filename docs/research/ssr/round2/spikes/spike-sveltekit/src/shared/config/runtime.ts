import { z } from 'zod'

export type RobotsPolicy = 'index' | 'noindex'

export interface RuntimeConfig {
  origin: string
  robotsPolicy: RobotsPolicy
}

// Ни одной top-level конструкции zod: иначе модуль становится side-effectful
// и уезжает в клиентский бандл вместе со всей библиотекой.
export function resolveOrigin(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback
  const trimmed = raw.replace(/\/+$/, '')
  return z.url().safeParse(trimmed).success ? trimmed : fallback
}

export function resolveRobotsPolicy(raw: string | undefined): RobotsPolicy {
  return z.enum(['index', 'noindex']).safeParse(raw).success ? (raw as RobotsPolicy) : 'index'
}
