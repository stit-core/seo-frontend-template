import fs from 'node:fs'
import { test } from 'vitest'
import PostCard from './post-card.astro'

test('исходник трансформации', () => {
  fs.writeFileSync('/tmp/astro-src.txt', String(PostCard).slice(0, 600))
})
