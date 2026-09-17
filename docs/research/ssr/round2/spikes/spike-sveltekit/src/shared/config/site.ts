// Константы без зависимостей: этот модуль попадает в клиентский граф через
// shared/seo, поэтому тянуть сюда zod нельзя — он утечёт в бандл острова.
export const SITE_NAME = 'stit demo'
export const POSTS_PER_PAGE = 5

// Плейсхолдер вместо origin: при prerender рантайм-переменных ещё нет,
// подстановку делает entrypoint контейнера (режим C).
export const PRERENDER_ORIGIN = 'https://__SITE_ORIGIN__'

/** Зафиксирован на сборке через vite `define`. */
export const RENDER_MODE = __RENDER_MODE__
