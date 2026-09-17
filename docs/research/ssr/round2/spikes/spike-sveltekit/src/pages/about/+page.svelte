<script lang="ts">
import { getLocale, m } from '@/shared/i18n'
import { breadcrumbJsonLd, type Locale, SeoHead } from '@/shared/seo'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()
const locale = getLocale() as Locale
</script>

<SeoHead
  origin={data.origin}
  path="/about"
  {locale}
  title={m.about_title()}
  description={m.site_tagline()}
  robotsPolicy={data.robotsPolicy}
  jsonLd={[breadcrumbJsonLd(data.origin, [{ name: m.breadcrumb_home(), path: '/' }, { name: m.about_title(), path: '/about' }], locale)]}
/>

<section class="shell">
  <h1>{m.about_title()}</h1>
  <p class="lead">{m.site_tagline()}</p>
  <p>
    Этот сайт существует ради одной проверки: можно ли собрать контент-first проект, который отдаёт
    полный HTML без единого байта JavaScript, держит честные коды ответов и не требует CDN.
  </p>
</section>
