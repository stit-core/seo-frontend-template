import type { ReactNode } from 'react'
export default function RootLayout({ children }: { children: ReactNode }) {
  return (<html lang="ru"><body><header>SHELL</header>{children}</body></html>)
}
