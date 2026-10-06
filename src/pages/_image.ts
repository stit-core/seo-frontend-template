import type { APIRoute } from 'astro'

// /_image собранного сайта не обслуживается: картинки страниц оптимизирует сборка (`/_astro/*`),
// а трансформация на запрос гоняла бы sharp для любого анонимного клиента — CPU и память
// процесса до отказа /healthz. Маршрут вводит сам Astro (`image.endpoint` в astro.config.ts);
// `_` в имени файла не даёт файловому роутингу подхватить его второй раз.
export const ALL: APIRoute = () =>
  new Response('Not found', {
    status: 404,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-cache',
      'x-robots-tag': 'noindex',
    },
  })
