import { z } from 'zod'

const RuntimeConfigSchema = z.object({
  SITE_URL: z.url(),
  ROBOTS_POLICY: z.enum(['index', 'noindex']).default('index'),
  RELEASE: z.string().default('unknown'),
})

export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>

// На on-demand роутах process.env живой (Node-процесс контейнера);
// при prerender сюда попадают значения сборки — это и есть ограничение «одного образа».
export function getRuntimeConfig(): RuntimeConfig {
  return RuntimeConfigSchema.parse({
    SITE_URL: process.env.SITE_URL ?? 'http://localhost:3201',
    ROBOTS_POLICY: process.env.ROBOTS_POLICY ?? 'index',
    RELEASE: process.env.RELEASE ?? 'unknown',
  })
}

export const SITE_NAME = 'stit demo'
