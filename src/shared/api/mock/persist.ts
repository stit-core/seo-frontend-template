import type { DB } from './db'

const KEY = 'app.mock.db.v1'

interface Snapshot {
  users: ReturnType<DB['user']['getAll']>
  sessions: ReturnType<DB['session']['getAll']>
  todos: ReturnType<DB['todo']['getAll']>
}

export function loadSnapshot(db: DB): boolean {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return false
    const snap = JSON.parse(raw) as Snapshot
    for (const u of snap.users) db.user.create(u)
    for (const s of snap.sessions) db.session.create(s)
    for (const t of snap.todos) db.todo.create(t)
    return true
  } catch {
    return false
  }
}

export function saveSnapshot(db: DB): void {
  const snap: Snapshot = {
    users: db.user.getAll(),
    sessions: db.session.getAll(),
    todos: db.todo.getAll(),
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(snap))
  } catch {
    // out-of-quota — игнорируем
  }
}

export function clearSnapshot(): void {
  localStorage.removeItem(KEY)
}
