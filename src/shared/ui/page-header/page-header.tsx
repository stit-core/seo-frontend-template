import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-divider pb-4 mb-6">
      <div>
        <h1 className="text-heading-lg font-semibold">{title}</h1>
        {description && <p className="text-body-md text-muted mt-1">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </header>
  )
}
