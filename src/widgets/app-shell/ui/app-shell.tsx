import { Link, Outlet } from '@tanstack/react-router'
import { useLogoutMutation, useSession } from '@/entities/session'
import { ThemeSwitcher, useThemeEffect } from '@/features/theme'

export function AppShell() {
  useThemeEffect()
  const { isAuthenticated, session } = useSession()
  const logout = useLogoutMutation()

  return (
    <div className="min-h-full flex flex-col">
      <header className="flex items-center justify-between px-6 py-3 border-b border-divider">
        <nav className="flex gap-4 items-center">
          <Link to="/" className="font-semibold">
            SPA
          </Link>
          {isAuthenticated && (
            <>
              <Link to="/profile" className="text-body-sm">
                Профиль
              </Link>
              <Link to="/todos" className="text-body-sm">
                Задачи
              </Link>
            </>
          )}
        </nav>
        <div className="flex gap-3 items-center">
          <ThemeSwitcher />
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => logout.mutate()}
              className="text-body-sm px-3 py-1 rounded-control border border-divider"
            >
              Выйти ({session?.email})
            </button>
          ) : (
            <Link
              to="/login"
              className="text-body-sm px-3 py-1 rounded-control bg-action-bg text-action-fg"
            >
              Войти
            </Link>
          )}
        </div>
      </header>
      <main className="flex-1 px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
