import type { DB } from '../db'
import { makeTodo, makeUser } from '../seeds/factories'

export type Scenario = 'empty' | 'populated' | 'authenticated' | 'error'

const BOOTSTRAP_SESSION_ID = 'session-bootstrap'

export function loadScenario(db: DB, scenario: Scenario): void {
  resetDb(db)
  switch (scenario) {
    case 'empty':
      return
    case 'populated':
      seedPopulated(db)
      return
    case 'authenticated':
      seedAuthenticated(db)
      return
    case 'error':
      return
  }
}

function resetDb(db: DB) {
  db.user.deleteMany({ where: {} })
  db.session.deleteMany({ where: {} })
  db.todo.deleteMany({ where: {} })
  setSessionCookie(null)
}

function seedPopulated(db: DB) {
  const me = makeUser(db, { email: 'me@example.com', password: 'password123', name: 'Я' })
  for (let i = 0; i < 5; i += 1) makeUser(db)
  for (let i = 0; i < 3; i += 1) makeTodo(db, me.id, false)
  for (let i = 0; i < 2; i += 1) makeTodo(db, me.id, true)
}

function seedAuthenticated(db: DB) {
  const me = makeUser(db, { email: 'me@example.com', password: 'password123', name: 'Я' })
  db.session.create({
    id: BOOTSTRAP_SESSION_ID,
    userId: me.id,
    email: me.email,
    createdAt: new Date().toISOString(),
  })
  for (let i = 0; i < 3; i += 1) makeTodo(db, me.id, false)
  // Хендлеры ищут сессию по cookie — «уже залогинен» требует и cookie в браузере.
  setSessionCookie(BOOTSTRAP_SESSION_ID)
}

// В node-тестах (msw/node) document нет — cookie актуальна только в браузере.
function setSessionCookie(sessionId: string | null) {
  if (typeof document === 'undefined') return
  document.cookie = sessionId
    ? `app_session=${sessionId}; Path=/; SameSite=Lax`
    : 'app_session=; Path=/; Max-Age=0'
}
