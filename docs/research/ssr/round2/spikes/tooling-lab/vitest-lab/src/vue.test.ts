import { mount } from '@vue/test-utils'
import axe from 'axe-core'
import { expect, test } from 'vitest'
import Card from './Card.vue'

test('vue: рендер + a11y', async () => {
  const w = mount(Card, { props: { title: 'Пост' }, attachTo: document.body })
  expect(w.get('h2').text()).toBe('Пост')
  const res = await axe.run(w.element as unknown as Element, { rules: { region: { enabled: false } } })
  expect(res.violations).toEqual([])
}, 20000)
