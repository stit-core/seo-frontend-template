import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = ({ locals }) => ({
  origin: locals.origin,
  robotsPolicy: locals.robotsPolicy,
})
