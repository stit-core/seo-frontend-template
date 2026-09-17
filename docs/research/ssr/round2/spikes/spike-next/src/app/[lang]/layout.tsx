import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { getSiteUrl } from '@/shared/config'
import { isLocale, LOCALES, type Locale } from '@/shared/i18n'
import { SiteFooter } from '@/widgets/site-footer'
import { SiteHeader } from '@/widgets/site-header'
import '../styles/index.css'

const inter = localFont({
  src: [
    { path: '../fonts/inter-latin-wght-normal.woff2', weight: '100 900', style: 'normal' },
    { path: '../fonts/inter-cyrillic-wght-normal.woff2', weight: '100 900', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-inter',
  fallback: ['system-ui', 'sans-serif'],
})

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfbfa' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0b' },
  ],
}

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
}

export function generateStaticParams(): Array<{ lang: Locale }> {
  return LOCALES.map((lang) => ({ lang }))
}

export default async function RootLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()

  return (
    <html lang={lang} className={inter.variable}>
      <body style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif' }}>
        <SiteHeader locale={lang} path="/" />
        <main>{children}</main>
        <SiteFooter locale={lang} />
      </body>
    </html>
  )
}
