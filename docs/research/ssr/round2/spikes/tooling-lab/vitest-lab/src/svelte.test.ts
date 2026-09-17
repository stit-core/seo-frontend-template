import { render } from '@testing-library/svelte'
import axe from 'axe-core'
import { expect, test } from 'vitest'
import Card from './Card.svelte'

test('svelte: рендер + a11y', async () => {
  const { container, getByRole } = render(Card, { props: { title: 'Пост' } })
  expect(getByRole('heading', { level: 2 }).textContent).toBe('Пост')
  const res = await axe.run(container, { rules: { region: { enabled: false } } })
  expect(res.violations).toEqual([])
}, 20000)
