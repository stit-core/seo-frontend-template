// Данные страниц strategy: now — страница on-demand маршрута now.astro, его модуль (законно); o-nas — prerendered
// страница: её данные в серверном бандле — снимок целиком.
const now = { page: { id: 'now' } }
const oNas = { page: { id: 'o-nas' } }
export default {
  'site/site/plans/now.yaml': now,
  'site/site/plans/o-nas.yaml': oNas,
}
