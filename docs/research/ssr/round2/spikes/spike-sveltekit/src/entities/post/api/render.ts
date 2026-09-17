import type { Component } from 'svelte'
import { render } from 'svelte/server'

// Markdown компилируется mdsvex в Svelte-компоненты. Рендерим их в строку
// прямо на сервере: если тянуть их через +page.ts (universal load), весь
// контент вместе с gray-matter уезжает в клиентский бандл (замерено +318 КБ).
const bodies = import.meta.glob('../content/*.md', { eager: true, import: 'default' }) as Record<
  string,
  Component
>

export function renderPostBody(slug: string): string | null {
  const component = bodies[`../content/${slug}.md`]
  return component ? render(component).body : null
}
