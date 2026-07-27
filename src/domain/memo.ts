export type Memo = {
  id: string
  text: string
  updatedAt: number
}

export function createMemo(text: string = ''): Memo {
  return {
    id: crypto.randomUUID(),
    text,
    updatedAt: Date.now(),
  }
}
