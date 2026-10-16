// Данные страниц strategy (законно): now — модуль on-demand маршрута now.astro; zhivaya — его модуль через каталог с
// index.ts и путь .ts без расширения; zapros — динамическим импортом в разметке без расширения .astro. Нарушение: o-nas —
// prerendered страница, её данные в серверном бандле — снимок целиком.
const now = { page: { id: 'now' } }
const zhivaya = { page: { id: 'zhivaya' } }
const zapros = { page: { id: 'zapros' } }
const oNas = { page: { id: 'o-nas' } }
export default {
  'site/site/plans/now.yaml': now,
  'site/site/plans/zhivaya.yaml': zhivaya,
  'site/site/plans/zapros.yaml': zapros,
  'site/site/plans/o-nas.yaml': oNas,
}
