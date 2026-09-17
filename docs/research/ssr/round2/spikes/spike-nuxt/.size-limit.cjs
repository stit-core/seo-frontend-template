// Бюджетируется клиентский граф, который реально грузит контентная страница.
// Nuxt не даёт стабильных имён чанков, поэтому бюджет ставится на весь _nuxt/*.js
// и отдельно на CSS; страничный «сколько реально скачал браузер» меряет e2e.
module.exports = [
  {
    name: 'client JS total (_nuxt/**.js)',
    path: '.output/public/_nuxt/*.js',
    limit: '340 KB',
    gzip: true,
  },
  {
    name: 'client CSS',
    path: '.output/public/_nuxt/*.css',
    limit: '8 KB',
    gzip: true,
  },
]
