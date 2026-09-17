import type { User } from '../model/schema'

interface UserCardProps {
  user: User
}

export function UserCard({ user }: UserCardProps) {
  return (
    <article className="flex items-center gap-3 p-4 rounded-control border border-divider">
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt="" className="w-12 h-12 rounded-full" />
      ) : (
        <div className="w-12 h-12 rounded-full bg-surface-muted" aria-hidden="true" />
      )}
      <div>
        <div className="font-semibold">{user.name}</div>
        <div className="text-body-sm text-muted">{user.email}</div>
      </div>
    </article>
  )
}
