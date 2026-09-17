<script lang="ts">
  import { cn } from '@/shared/lib'
  let { label = 'ok' }: { label?: string } = $props()
</script>

<button class={cn('btn')}>{label}</button>
