import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Suspense } from 'react'
import { sessionQueryOptions } from '@/entities/session'
import { UserCard, userQueryOptions } from '@/entities/user'
import { PageHeader } from '@/shared/ui/page-header'

export const Route = createFileRoute('/profile')({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions)
    if (!session) throw redirect({ to: '/login' })
    return { session }
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(userQueryOptions(context.session.userId))
  },
  component: ProfilePage,
})

function ProfilePage() {
  const { session } = Route.useRouteContext()
  return (
    <>
      <PageHeader title="Профиль" />
      <Suspense fallback={<p>Загрузка…</p>}>
        <ProfileBody userId={session.userId} />
      </Suspense>
    </>
  )
}

function ProfileBody({ userId }: { userId: string }) {
  const { data: user } = useSuspenseQuery(userQueryOptions(userId))
  return <UserCard user={user} />
}
