import type { RobotsPolicy } from '@/shared/config'

declare global {
  namespace App {
    interface Locals {
      origin: string
      robotsPolicy: RobotsPolicy
    }
  }

  /** Режим рендера, зафиксированный на сборке: 'A' | 'C' | 'D'. */
  const __RENDER_MODE__: string
}
