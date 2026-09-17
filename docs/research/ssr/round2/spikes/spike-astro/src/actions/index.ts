// Astro требует этот путь; сама логика — в слайсе features/contact-form.
// Deep-import осознанный: server-only entry намеренно не в public API слайса.
import { contact } from '@/features/contact-form/api/action'

export const server = { contact }
