// Дефолт сайта: контент пререндерится (A/C) либо рендерится на запрос с кешем (D);
// гидрации нет нигде. Роуты, которым нужен рантайм или интерактив, переопределяют это.
export const prerender = __RENDER_MODE__ !== 'D'
export const csr = false
export const trailingSlash = 'never'
