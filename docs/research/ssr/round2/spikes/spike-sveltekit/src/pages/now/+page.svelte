<script lang="ts">
import { getLocale, m } from '@/shared/i18n'
import { type Locale, SeoHead } from '@/shared/seo'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()
const locale = getLocale() as Locale
</script>

<SeoHead
  origin={data.origin}
  path="/now"
  {locale}
  title={m.now_title()}
  description={m.site_tagline()}
  robotsPolicy={data.robotsPolicy}
/>

<section class="shell">
  <h1>{m.now_title()}</h1>
  <p class="lead">
    <time datetime={data.serverTime}>{data.serverTime}</time>
  </p>
  <p>uptime: {data.uptimeSec}s</p>
</section>
