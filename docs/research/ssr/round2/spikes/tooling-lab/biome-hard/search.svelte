<script lang="ts">
  type Item = { id: string; title: string }
  let { items = [] }: { items?: Item[] } = $props()
  let query = $state('')
  const filtered = $derived(items.filter((i) => i.title.includes(query)))
</script>

{#snippet row(item: Item)}
  <li>{item.title}</li>
{/snippet}

<input bind:value={query} aria-label="Поиск" />
{#if filtered.length > 0}
  <ul>
    {#each filtered as item (item.id)}
      {@render row(item)}
    {/each}
  </ul>
{:else}
  <p>Ничего не найдено</p>
{/if}
<img src="/x.png" />
