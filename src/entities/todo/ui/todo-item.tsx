import type { Todo } from '../model/schema'

interface TodoItemProps {
  todo: Todo
  onToggle?: (todo: Todo) => void
  onDelete?: (todo: Todo) => void
}

export function TodoItem({ todo, onToggle, onDelete }: TodoItemProps) {
  return (
    <li
      data-done={todo.done}
      className="flex items-center gap-3 p-3 rounded-control border border-divider data-[done=true]:opacity-60"
    >
      <input
        type="checkbox"
        checked={todo.done}
        onChange={() => onToggle?.(todo)}
        aria-label={`Toggle ${todo.title}`}
        className="w-4 h-4"
      />
      <span className="flex-1 data-[done=true]:line-through" data-done={todo.done}>
        {todo.title}
      </span>
      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(todo)}
          className="text-body-sm text-muted hover:text-danger"
          aria-label={`Delete ${todo.title}`}
        >
          Удалить
        </button>
      )}
    </li>
  )
}
