import { beforeEach, describe, expect, it, vi } from 'vitest'
import { get } from 'svelte/store'
import type { ExtensionContext, HostFs } from '../../src/core/host'

/** 内存假 HostFs：键为段数组 join('/')；写失败可经 mockRejectedValueOnce 注入。 */
function fakeFs() {
  const files = new Map<string, string>()
  const fs: HostFs = {
    readFile: vi.fn(async (path: string[]) => {
      const v = files.get(path.join('/'))
      return v === undefined ? null : new TextEncoder().encode(v)
    }),
    writeFile: vi.fn(async (path: string[], data: Uint8Array) => {
      files.set(path.join('/'), new TextDecoder().decode(data))
    }),
    readJson: vi.fn(async (path: string[]) => {
      const v = files.get(path.join('/'))
      return v === undefined ? null : JSON.parse(v)
    }),
    writeJson: vi.fn(async (path: string[], value: unknown) => {
      files.set(path.join('/'), JSON.stringify(value))
    }),
    listDir: vi.fn(async (path: string[] = []) => {
      const prefix = path.length === 0 ? '' : path.join('/') + '/'
      const found = [...files.keys()].filter((k) => k.startsWith(prefix))
      if (path.length > 0 && found.length === 0) return null
      return {
        dirs: [],
        files: found.map((k) => k.slice(prefix.length)).filter((k) => !k.includes('/')),
      }
    }),
    remove: vi.fn(async (path: string[]) => {
      files.delete(path.join('/'))
    }),
  }
  return { files, fs }
}

/** 构造注入假 fs 的扩展上下文。 */
function fakeCtx(fs: HostFs): ExtensionContext {
  return {
    extId: 'todo',
    fs,
    log: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
  }
}

describe('todo store', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    // 固定「今天」为本地 2026-09-04，供 checkInToday 等取本地日历日
    vi.setSystemTime(new Date(2026, 8, 4, 10, 0, 0))
  })

  /** 重置模块后载入被测 store 与假上下文。 */
  async function setup() {
    const { files, fs } = fakeFs()
    const store = await import('../../extensions/todo/src/store')
    return { ...store, ctx: fakeCtx(fs), files }
  }

  it('todos 目录不存在时载入为空列表', async () => {
    const s = await setup()
    expect(get(s.todos)).toBeNull()
    await s.loadTodos(s.ctx)
    expect(get(s.todos)).toEqual([])
  })

  it('载入全部待办，损坏文件跳过', async () => {
    const s = await setup()
    s.files.set(
      'todos/a.json',
      JSON.stringify({
        id: 'a',
        text: '旧',
        schedule: { kind: 'none' },
        checkIns: [],
        done: false,
        createdAt: 1,
        updatedAt: 1,
        version: 1,
      }),
    )
    s.files.set('todos/bad.json', '{oops')
    s.files.set('todos/incomplete.json', JSON.stringify({ id: 'c' }))
    await s.loadTodos(s.ctx)
    expect(get(s.todos)!.map((t) => t.id)).toEqual(['a'])
  })

  it('新建待办入列，未产生内容不落盘', async () => {
    const s = await setup()
    await s.loadTodos(s.ctx)
    const id = s.addTodo()
    expect(get(s.todos)![0].id).toBe(id)
    await vi.advanceTimersByTimeAsync(2000)
    expect(s.files.size).toBe(0)
  })

  it('输入正文后防抖 800ms 落盘', async () => {
    const s = await setup()
    await s.loadTodos(s.ctx)
    const id = s.addTodo()
    s.updateTodoText(s.ctx, id, '记得买牛奶')
    expect(s.files.size).toBe(0)
    await vi.advanceTimersByTimeAsync(800)
    await s.flushTodo(s.ctx, id)
    const saved = JSON.parse(s.files.get(`todos/${id}.json`)!)
    expect(saved.text).toBe('记得买牛奶')
    expect(saved.done).toBe(false)
  })

  it('勾选完成立即落盘（不经防抖）', async () => {
    const s = await setup()
    await s.loadTodos(s.ctx)
    const id = s.addTodo()
    s.updateTodoText(s.ctx, id, '交报告')
    await s.toggleDone(s.ctx, id)
    const saved = JSON.parse(s.files.get(`todos/${id}.json`)!)
    expect(saved.done).toBe(true)
    expect(saved.text).toBe('交报告')
    expect(get(s.todos)![0].done).toBe(true)
  })

  it('区间打卡立即落盘，达标自动完成', async () => {
    const s = await setup()
    await s.loadTodos(s.ctx)
    const id = s.addTodo()
    await s.changeSchedule(s.ctx, id, {
      kind: 'range',
      start: '2026-09-01',
      end: '2026-09-30',
      requiredDays: 2,
    })
    await s.checkInToday(s.ctx, id)
    let saved = JSON.parse(s.files.get(`todos/${id}.json`)!)
    expect(saved.checkIns).toEqual(['2026-09-04'])
    expect(saved.done).toBe(false)
    // 推进到第二天再打卡，达标 → 自动完成
    vi.setSystemTime(new Date(2026, 8, 5, 10, 0, 0))
    await s.checkInToday(s.ctx, id)
    saved = JSON.parse(s.files.get(`todos/${id}.json`)!)
    expect(saved.checkIns).toEqual(['2026-09-04', '2026-09-05'])
    expect(saved.done).toBe(true)
  })

  it('更换调度立即落盘，切出区间型清空打卡', async () => {
    const s = await setup()
    await s.loadTodos(s.ctx)
    const id = s.addTodo()
    await s.changeSchedule(s.ctx, id, {
      kind: 'range',
      start: '2026-09-01',
      end: '2026-09-30',
      requiredDays: 5,
    })
    await s.checkInToday(s.ctx, id)
    await s.changeSchedule(s.ctx, id, { kind: 'deadline', due: '2026-09-10' })
    const saved = JSON.parse(s.files.get(`todos/${id}.json`)!)
    expect(saved.schedule).toEqual({ kind: 'deadline', due: '2026-09-10' })
    expect(saved.checkIns).toEqual([])
  })

  it('新建后失焦完全为空则静默丢弃（不落盘）', async () => {
    const s = await setup()
    await s.loadTodos(s.ctx)
    const id = s.addTodo()
    await s.blurTodo(s.ctx, id)
    expect(get(s.todos)).toEqual([])
    expect(s.files.size).toBe(0)
  })

  it('正文为空但设了调度的待办失焦保留', async () => {
    const s = await setup()
    await s.loadTodos(s.ctx)
    const id = s.addTodo()
    await s.changeSchedule(s.ctx, id, { kind: 'deadline', due: '2026-09-10' })
    await s.blurTodo(s.ctx, id)
    expect(get(s.todos)!.map((t) => t.id)).toEqual([id])
    expect(s.files.get(`todos/${id}.json`)).toBeDefined()
  })

  it('removeTodo 删除文件并从列表移除', async () => {
    const s = await setup()
    await s.loadTodos(s.ctx)
    const id = s.addTodo()
    s.updateTodoText(s.ctx, id, 'x')
    await s.flushTodo(s.ctx, id)
    await s.removeTodo(s.ctx, id)
    expect(get(s.todos)).toEqual([])
    expect(s.files.size).toBe(0)
  })

  it('保存失败标记 saveErrors 并保留脏数据，重试成功清除', async () => {
    const s = await setup()
    await s.loadTodos(s.ctx)
    const id = s.addTodo()
    s.updateTodoText(s.ctx, id, 'x')
    vi.mocked(s.ctx.fs.writeJson).mockRejectedValueOnce(new Error('写盘失败'))
    await s.flushTodo(s.ctx, id)
    expect(get(s.saveErrors).has(id)).toBe(true)
    await s.flushTodo(s.ctx, id) // 重试
    expect(get(s.saveErrors).size).toBe(0)
    expect(s.files.get(`todos/${id}.json`)).toBeDefined()
  })

  it('离散操作落盘连同防抖期内的正文一起写入', async () => {
    const s = await setup()
    await s.loadTodos(s.ctx)
    const id = s.addTodo()
    s.updateTodoText(s.ctx, id, '还没过防抖期')
    await s.toggleDone(s.ctx, id)
    const saved = JSON.parse(s.files.get(`todos/${id}.json`)!)
    expect(saved.text).toBe('还没过防抖期')
    expect(saved.done).toBe(true)
  })
})
