<script lang="ts">
import { m } from '@/shared/i18n'
import { page } from '$app/state'
</script>

<svelte:head>
  <title>{page.status} — stit demo</title>
  <meta name="robots" content="noindex, nofollow">
</svelte:head>

<section class="shell">
  <h1>
    {page.status === 404 ? m.not_found_title() : `${page.status} — ${page.error?.message ?? ''}`}
  </h1>
  <p class="lead">{m.not_found_lead()}</p>
  <p><a href="/">stit demo</a></p>
</section>
