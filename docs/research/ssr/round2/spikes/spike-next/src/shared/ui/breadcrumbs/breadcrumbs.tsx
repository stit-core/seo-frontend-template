import Link from 'next/link'

export interface Crumb {
  name: string
  href: string
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="breadcrumbs" className="text-body-sm text-muted">
      <ol className="flex flex-wrap gap-1">
        {items.map((item, index) => (
          <li key={item.href} className="flex gap-1">
            {index > 0 && <span aria-hidden="true">/</span>}
            {index === items.length - 1 ? (
              <span aria-current="page">{item.name}</span>
            ) : (
              <Link href={item.href} className="underline">
                {item.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
