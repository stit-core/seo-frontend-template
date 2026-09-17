import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/shared/ui/page-header'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <>
      <PageHeader
        title="SPA"
        description="Это шаблон. В docs/fsd и docs/stack описано, что под капотом."
      />
      <p className="text-body-md">
        Зайди под любым email/паролем (mock-режим пускает всех) и попробуй раздел «Задачи».
      </p>
    </>
  )
}
