import { createFileRoute, redirect } from '@tanstack/react-router'
import { readSession } from '@/shared/api/session'
import { robotsMeta } from '@/shared/seo'
import { PageHeader } from '@/shared/ui/page-header'
import { SiteShell } from '@/widgets/site-shell'

// ssr:false — beforeLoad НЕ выполняется на сервере, значит редирект произойдёт
// только в браузере после гидрации (сервер отдаст 200 + pendingComponent).
export const Route = createFileRoute('/profile')({
  ssr: false,
  head: () => ({ meta: [{ title: 'Профиль' }, ...robotsMeta(true)] }),
  beforeLoad: () => {
    if (!readSession()) throw redirect({ to: '/login' })
  },
  pendingComponent: () => <p className="px-6 py-8">Загрузка профиля…</p>,
  component: () => (
    <SiteShell>
      <PageHeader title="Профиль" description="Приватная страница, рендер только на клиенте." />
    </SiteShell>
  ),
})
