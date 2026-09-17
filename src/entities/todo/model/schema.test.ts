import { NewTodoSchema, TodoSchema } from './schema'

describe('TodoSchema', () => {
  it('парсит валидный todo', () => {
    const todo = TodoSchema.parse({
      id: 'todo-1',
      title: 'Полить цветы',
      done: false,
      createdAt: '2024-01-01T00:00:00.000Z',
    })
    expect(todo.title).toBe('Полить цветы')
  })

  it('отклоняет не-ISO createdAt', () => {
    const result = TodoSchema.safeParse({
      id: 'todo-1',
      title: 'x',
      done: false,
      createdAt: 'вчера',
    })
    expect(result.success).toBe(false)
  })

  it('отклоняет пустой title', () => {
    const result = TodoSchema.safeParse({
      id: 'todo-1',
      title: '',
      done: false,
      createdAt: '2024-01-01T00:00:00.000Z',
    })
    expect(result.success).toBe(false)
  })
})

describe('NewTodoSchema', () => {
  it('трримит и принимает непустой title', () => {
    expect(NewTodoSchema.parse({ title: '  задача  ' })).toEqual({ title: 'задача' })
  })

  it('отклоняет title из одних пробелов', () => {
    expect(NewTodoSchema.safeParse({ title: '   ' }).success).toBe(false)
  })

  it('отклоняет title длиннее 200 символов', () => {
    expect(NewTodoSchema.safeParse({ title: 'а'.repeat(201) }).success).toBe(false)
  })
})
