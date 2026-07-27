import { writable, get } from 'svelte/store'
import { storageService } from '../lib/storageService'
import type { Todo } from '../domain/todo'

export const todos = writable<Todo[]>([])

async function persist(list: Todo[]): Promise<void> {
  todos.set(list)
  await storageService.saveTodos(list)
}

export async function loadTodos(): Promise<void> {
  todos.set(await storageService.loadTodos())
}

export async function addTodo(t: Todo): Promise<void> {
  await persist([...get(todos), t])
}

export async function updateTodo(t: Todo): Promise<void> {
  await persist(get(todos).map((x) => (x.id === t.id ? t : x)))
}

export async function removeTodo(id: string): Promise<void> {
  await persist(get(todos).filter((x) => x.id !== id))
}
