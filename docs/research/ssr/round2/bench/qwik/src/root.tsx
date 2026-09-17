import { component$ } from '@qwik.dev/core'
import { QwikRouterProvider, RouterOutlet } from '@qwik.dev/router'
import './global.css'

export default component$(() => (
  <QwikRouterProvider>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Пол JS: одинаковая контентная страница</title>
    </head>
    <body lang="ru">
      <RouterOutlet />
    </body>
  </QwikRouterProvider>
))
