import { factory, nullable, primaryKey } from '@mswjs/data'

// In-memory ORM-зеркало доменных сущностей. Имена и поля приходят из
// docs/domains/<context>/* (через fsd-deep-dive). Здесь — reference-набор
// под учебные слайсы (session/user/todo).
export const db = factory({
  user: {
    id: primaryKey(String),
    email: String,
    password: String,
    name: String,
    avatarUrl: nullable(String),
    createdAt: String,
  },
  session: {
    id: primaryKey(String),
    userId: String,
    email: String,
    createdAt: String,
  },
  todo: {
    id: primaryKey(String),
    title: String,
    done: Boolean,
    createdAt: String,
    ownerId: String,
  },
})

export type DB = typeof db
