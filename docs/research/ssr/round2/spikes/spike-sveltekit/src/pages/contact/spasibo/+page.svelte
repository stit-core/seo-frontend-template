<script lang="ts">
import { getLocale, localizeHref, m } from '@/shared/i18n'
import { type Locale, SeoHead } from '@/shared/seo'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()
const locale = getLocale() as Locale
</script>

<SeoHead
  origin={data.origin}
  path="/contact/spasibo"
  {locale}
  title={m.contact_thanks()}
  description={m.contact_thanks()}
  robotsPolicy={data.robotsPolicy}
  indexable={false}
/>

<section class="shell">
  <h1>{m.contact_thanks()}</h1>
  <p><a href={localizeHref('/')}>{m.nav_home()}</a></p>
</section>
