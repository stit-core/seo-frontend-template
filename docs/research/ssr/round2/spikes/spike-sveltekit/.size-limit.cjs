// Бюджетируется то, что реально грузит браузер. Контентные страницы идут с
// csr = false и грузят 0 байт JS (проверяется e2e-тестом); сюда попадает
// «пол» гидрации острова: точка входа + рантайм Svelte/Kit + узлы маршрутов.
module.exports = [
  {
    name: 'client entry (start + app)',
    path: 'build/client/_app/immutable/entry/*.js',
    limit: '3 KB',
    gzip: true,
  },
  {
    name: 'route nodes',
    path: 'build/client/_app/immutable/nodes/*.js',
    limit: '14 KB',
    gzip: true,
  },
  {
    name: 'CSS',
    path: 'build/client/_app/immutable/assets/*.css',
    limit: '8 KB',
    gzip: true,
  },
]
