<script lang="ts">
import { ContactForm } from '@/features/contact-form'
import { getLocale, m } from '@/shared/i18n'
import { breadcrumbJsonLd, type Locale, SeoHead } from '@/shared/seo'
import type { ActionData, PageData } from './$types'

let { data, form }: { data: PageData; form: ActionData } = $props()
const locale = getLocale() as Locale
</script>

<SeoHead
  origin={data.origin}
  path="/contact"
  {locale}
  title={m.contact_title()}
  description={m.site_tagline()}
  robotsPolicy={data.robotsPolicy}
  jsonLd={[
    breadcrumbJsonLd(
      data.origin,
      [
        { name: m.breadcrumb_home(), path: '/' },
        { name: m.contact_title(), path: '/contact' },
      ],
      locale,
    ),
  ]}
/>

<section class="shell">
  <h1>{m.contact_title()}</h1>
  <ContactForm {form} issuedAt={data.issuedAt} />
</section>
