<script lang="ts">
import { localizeHref, m } from '@/shared/i18n'
</script>

<section class="shell">
  <h1>{m.home_hero_title()}</h1>
  <p class="lead">{m.home_hero_lead()}</p>
  <p><a class="button" href={localizeHref('/blog')}>{m.home_cta()}</a></p>
</section>
