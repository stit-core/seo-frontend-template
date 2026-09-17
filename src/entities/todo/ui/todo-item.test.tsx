import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import type { Todo } from '../model/schema'
import { TodoItem } from './todo-item'

const todo: Todo = {
  id: 'todo-1',
  title: 'Полить цветы',
  done: false,
  createdAt: '2024-01-01T00:00:00.000Z',
}

// TodoItem рендерит <li> — оборачиваем в <ul>, как в реальной разметке.
function renderItem(props: Partial<Parameters<typeof TodoItem>[0]> = {}) {
  return render(
    <ul>
      <TodoItem todo={todo} {...props} />
    </ul>,
  )
}

describe('TodoItem', () => {
  it('показывает title и состояние чекбокса', () => {
    renderItem()
    expect(screen.getByText('Полить цветы')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Toggle Полить цветы' })).not.toBeChecked()
  })

  it('зовёт onToggle по клику на чекбокс', async () => {
    const onToggle = vi.fn()
    renderItem({ onToggle })
    await userEvent.click(screen.getByRole('checkbox'))
    expect(onToggle).toHaveBeenCalledWith(todo)
  })

  it('зовёт onDelete по кнопке удаления; без onDelete кнопки нет', async () => {
    const onDelete = vi.fn()
    const { unmount } = renderItem({ onDelete })
    await userEvent.click(screen.getByRole('button', { name: 'Delete Полить цветы' }))
    expect(onDelete).toHaveBeenCalledWith(todo)
    unmount()

    renderItem()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('не имеет axe-нарушений', async () => {
    const { container } = renderItem({ onToggle: vi.fn(), onDelete: vi.fn() })
    expect(await axe(container)).toHaveNoViolations()
  })
})
