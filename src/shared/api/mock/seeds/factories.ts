import { faker } from '@faker-js/faker'
import type { DB } from '../db'

faker.seed(42)

export function makeUser(db: DB, overrides: Partial<Parameters<DB['user']['create']>[0]> = {}) {
  return db.user.create({
    id: faker.string.uuid(),
    email: faker.internet.email().toLowerCase(),
    password: 'password123',
    name: faker.person.fullName(),
    avatarUrl: faker.datatype.boolean(0.4) ? faker.image.avatar() : null,
    createdAt: faker.date.past().toISOString(),
    ...overrides,
  })
}

export function makeTodo(db: DB, ownerId: string, done = false) {
  return db.todo.create({
    id: faker.string.uuid(),
    title: faker.hacker.phrase(),
    done,
    createdAt: faker.date.recent().toISOString(),
    ownerId,
  })
}
