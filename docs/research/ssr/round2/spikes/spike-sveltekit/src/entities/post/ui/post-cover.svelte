<script lang="ts">
import type { Picture } from '@sveltejs/enhanced-img'

// Обложки лежат рядом с Markdown, путь в frontmatter динамический —
// enhanced-img умеет это только через glob с query enhanced.
const covers = import.meta.glob('../content/covers/*.png', {
  eager: true,
  query: { enhanced: true },
  import: 'default',
}) as Record<string, Picture>

interface Props {
  slug: string
  alt: string
  sizes?: string
  priority?: boolean
  class?: string
}

let {
  slug,
  alt,
  sizes = '(min-width: 48rem) 720px, 100vw',
  priority = false,
  class: klass = '',
}: Props = $props()

const picture = $derived(covers[`../content/covers/${slug}.png`])
</script>

{#if picture}
  <enhanced:img
    src={picture}
    {alt}
    {sizes}
    class={klass}
    loading={priority ? 'eager' : 'lazy'}
    fetchpriority={priority ? 'high' : 'auto'}
    decoding="async"
  />
{/if}
