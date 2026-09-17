import type { ParamMatcher } from '@sveltejs/kit'

// [page=page] — только натуральные числа, иначе роут не матчится и SvelteKit даёт 404.
export const match: ParamMatcher = (param) => /^[1-9][0-9]*$/.test(param)
