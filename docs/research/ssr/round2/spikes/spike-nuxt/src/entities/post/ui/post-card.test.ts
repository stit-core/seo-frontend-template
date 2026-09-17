import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PostCard from './post-card.vue'

// mount вместо mountSuspended: он не поднимает приложение целиком и не тащит src/pages/**.
describe('PostCard', () => {
  it('рендерит заголовок, описание и ссылку на пост', () => {
    const component = mount(PostCard, {
      props: {
        path: '/blog/ssr-bez-cdn',
        title: 'SSR без CDN',
        description: 'Кеш в процессе Node и ETag.',
        pubDate: '2026-03-03',
        cover: '/covers/ssr-bez-cdn.png',
        locale: 'ru',
      },
      global: {
        stubs: {
          NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
          NuxtImg: true,
        },
      },
    })

    expect(component.text()).toContain('SSR без CDN')
    expect(component.text()).toContain('Кеш в процессе Node и ETag.')
    expect(component.html()).toContain('href="/blog/ssr-bez-cdn"')
    // дата приходит локализованной, а не сырым ISO
    expect(component.text()).toContain('2026')
  })
})
