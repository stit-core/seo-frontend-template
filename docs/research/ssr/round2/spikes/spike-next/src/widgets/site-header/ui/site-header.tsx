import Link from 'next/link'
import { LOCALES, type Locale, localePath, t } from '@/shared/i18n'
import { Container } from '@/shared/ui/container'

export function SiteHeader({ locale, path }: { locale: Locale; path: string }) {
  const d = t(locale)

  return (
    <header className="border-divider bg-surface border-b">
      <Container className="flex flex-wrap items-center justify-between gap-3 py-4">
        <Link href={localePath(locale, '/')} className="text-heading-sm font-semibold">
          {d.siteName}
        </Link>
        <nav aria-label="main" className="text-body-sm flex gap-4">
          <Link href={localePath(locale, '/blog')}>{d.blog}</Link>
          <Link href={localePath(locale, '/about')}>{d.about}</Link>
          <Link href={localePath(locale, '/contact')}>{d.contact}</Link>
          <Link href={localePath(locale, '/now')}>{d.now}</Link>
        </nav>
        <ul className="text-body-sm text-muted flex gap-2">
          {LOCALES.map((item) => (
            <li key={item}>
              <Link
                href={localePath(item, path)}
                hrefLang={item}
                aria-current={item === locale ? 'true' : undefined}
                className={item === locale ? 'font-semibold underline' : undefined}
              >
                {item.toUpperCase()}
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </header>
  )
}
