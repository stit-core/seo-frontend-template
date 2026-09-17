interface PageHeaderProps {
  title: string
  description?: string
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header className="border-b border-divider pb-4 mb-6">
      <h1 className="text-heading-lg font-semibold">{title}</h1>
      {description && <p className="text-body-md text-muted mt-1">{description}</p>}
    </header>
  )
}
