<script module lang="ts">
  // Svelte 5 module-скрипт: cross-slice импорт на соседнюю фичу
  import { ContactFormSvelte } from '@/features/contact-form'
  export function search() {
    return ContactFormSvelte
  }
</script>

<script lang="ts">
  import { cn } from '@/shared/lib'
</script>

<input class={cn('search')} />
