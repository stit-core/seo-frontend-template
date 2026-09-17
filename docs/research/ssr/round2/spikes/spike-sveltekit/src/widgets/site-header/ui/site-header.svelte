<script lang="ts">
import { localizeHref, m } from '@/shared/i18n'

interface Props {
  locale: string
}
let { locale }: Props = $props()
const other = $derived(locale === 'ru' ? 'en' : 'ru')
</script>

<header class="site-header">
  <nav class="shell site-nav" aria-label="Основная навигация">
    <a class="site-nav__brand" href={localizeHref('/')}>{m.site_name()}</a>
    <a href={localizeHref('/')}>{m.nav_home()}</a>
    <a href={localizeHref('/blog')}>{m.nav_blog()}</a>
    <a href={localizeHref('/about')}>{m.nav_about()}</a>
    <a href={localizeHref('/contact')}>{m.nav_contact()}</a>
    <a href={localizeHref('/now')}>{m.nav_now()}</a>
    <a
      href={localizeHref('/', { locale: other })}
      data-sveltekit-reload
      hreflang={other}
      rel="alternate"
    >
      {other.toUpperCase()}
    </a>
  </nav>
</header>
