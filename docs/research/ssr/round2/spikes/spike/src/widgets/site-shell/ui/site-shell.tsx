import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <nav className="flex gap-4 border-b border-divider px-6 py-3 text-body-sm">
        <Link to="/">Главная</Link>
        <Link to="/$locale" params={{ locale: 'en' }}>
          EN
        </Link>
        <Link to="/login">Вход</Link>
        <Link to="/profile">Профиль</Link>
      </nav>
      <main className="px-6 py-8 max-w-3xl">{children}</main>
    </div>
  )
}
