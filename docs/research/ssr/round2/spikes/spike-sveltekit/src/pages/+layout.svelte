<script lang="ts">
import '@/app/styles/index.css'
import { getLocale } from '@/shared/i18n'
import { SiteFooter } from '@/widgets/site-footer'
import { SiteHeader } from '@/widgets/site-header'

let { children } = $props()
const locale = getLocale()
</script>

<SiteHeader {locale} />
<main id="main">
  {@render children()}
</main>
<SiteFooter />
