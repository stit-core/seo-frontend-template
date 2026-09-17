<script lang="ts">
  let { title = 'заголовок' }: { title?: string } = $props()
</script>

<article>
  <h2>{title}</h2>
  <img src="/cover.png" alt="обложка" />
</article>
