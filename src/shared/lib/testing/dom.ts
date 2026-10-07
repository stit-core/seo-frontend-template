import { Window } from 'happy-dom'

const window = new Window()

// Разметка Container API — документом: тест сверяет элементы, атрибуты и текст, а не подстроки.
// В dev-режиме Vitest Astro добавляет к тегам свои атрибуты (data-astro-source-*), и точная
// подстрока тега краснела бы от патча фреймворка, а не от поломки компонента.
export const parseHtml = (html: string) => new window.DOMParser().parseFromString(html, 'text/html')
