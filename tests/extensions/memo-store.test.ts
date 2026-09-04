import { beforeEach, describe, expect, it, vi } from 'vitest'
import { get } from 'svelte/store'
import type { ExtensionContext, HostFs } from '../../src/core/host'

/** 内存假 HostFs：键为段数组 join('/');写失败可经 failNextWrite 注入。 */
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
    extId: 'memo',
    fs,
    log: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
  }
}

describe('memo store', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
  })

  /** 重置模块后载入被测 store 与假上下文。 */
  async function setup() {
    const { files, fs } = fakeFs()
    const store = await import('../../extensions/memo/src/store')
    return { ...store, ctx: fakeCtx(fs), files }
  }

  it('memos 目录不存在时载入为空列表', async () => {
    const s = await setup()
    expect(get(s.memos)).toBeNull()
    await s.loadMemos(s.ctx)
    expect(get(s.memos)).toEqual([])
  })

  it('载入全部备忘并按 updatedAt 倒序，损坏文件跳过', async () => {
    const s = await setup()
    s.files.set('memos/a.json', JSON.stringify({ id: 'a', text: '旧', updatedAt: 1, version: 1 }))
    s.files.set('memos/b.json', JSON.stringify({ id: 'b', text: '新', updatedAt: 2, version: 1 }))
    s.files.set('memos/bad.json', '{oops')
    s.files.set('memos/incomplete.json', JSON.stringify({ id: 'c' }))
    await s.loadMemos(s.ctx)
    expect(get(s.memos)!.map((m) => m.id)).toEqual(['b', 'a'])
  })

  it('新建备忘置顶，未输入不落盘', async () => {
    const s = await setup()
    await s.loadMemos(s.ctx)
    const id = s.addMemo()
    expect(get(s.memos)![0].id).toBe(id)
    await vi.advanceTimersByTimeAsync(2000)
    expect(s.files.size).toBe(0)
  })

  it('输入后防抖 800ms 落盘', async () => {
    const s = await setup()
    await s.loadMemos(s.ctx)
    const id = s.addMemo()
    s.updateMemoText(s.ctx, id, '记得买牛奶')
    expect(s.files.size).toBe(0)
    await vi.advanceTimersByTimeAsync(800)
    await s.flushMemo(s.ctx, id)
    expect(s.files.get(`memos/${id}.json`)).toBeDefined()
    const saved = JSON.parse(s.files.get(`memos/${id}.json`)!)
    expect(saved.text).toBe('记得买牛奶')
  })

  it('保存后按新 updatedAt 重排到最前', async () => {
    const s = await setup()
    s.files.set('memos/a.json', JSON.stringify({ id: 'a', text: '旧', updatedAt: 1, version: 1 }))
    await s.loadMemos(s.ctx)
    const id = s.addMemo() // 新建在顶部
    s.updateMemoText(s.ctx, id, '新备忘')
    await vi.advanceTimersByTimeAsync(800)
    await s.flushMemo(s.ctx, id)
    expect(get(s.memos)![0].id).toBe(id)
    // 再编辑旧的，保存后浮到顶部
    s.updateMemoText(s.ctx, 'a', '旧备忘改了')
    await vi.advanceTimersByTimeAsync(800)
    await s.flushMemo(s.ctx, 'a')
    expect(get(s.memos)![0].id).toBe('a')
  })

  it('新建后失焦仍为空则静默丢弃（不落盘）', async () => {
    const s = await setup()
    await s.loadMemos(s.ctx)
    const id = s.addMemo()
    await s.blurMemo(s.ctx, id)
    expect(get(s.memos)).toEqual([])
    expect(s.files.size).toBe(0)
  })

  it('已落盘备忘清空后失焦即删除文件', async () => {
    const s = await setup()
    s.files.set('memos/a.json', JSON.stringify({ id: 'a', text: '内容', updatedAt: 1, version: 1 }))
    await s.loadMemos(s.ctx)
    s.updateMemoText(s.ctx, 'a', '')
    await s.blurMemo(s.ctx, 'a')
    expect(get(s.memos)).toEqual([])
    expect(s.files.size).toBe(0)
  })

  it('removeMemo 删除文件并从列表移除', async () => {
    const s = await setup()
    s.files.set('memos/a.json', JSON.stringify({ id: 'a', text: 'x', updatedAt: 1, version: 1 }))
    await s.loadMemos(s.ctx)
    await s.removeMemo(s.ctx, 'a')
    expect(get(s.memos)).toEqual([])
    expect(s.files.size).toBe(0)
  })

  it('保存失败标记 saveErrors 并保留脏数据，重试成功清除', async () => {
    const s = await setup()
    await s.loadMemos(s.ctx)
    const id = s.addMemo()
    s.updateMemoText(s.ctx, id, 'x')
    vi.mocked(s.ctx.fs.writeJson).mockRejectedValueOnce(new Error('写盘失败'))
    await s.flushMemo(s.ctx, id)
    expect(get(s.saveErrors).has(id)).toBe(true)
    await s.flushMemo(s.ctx, id) // 重试
    expect(get(s.saveErrors).size).toBe(0)
    expect(s.files.get(`memos/${id}.json`)).toBeDefined()
  })
})
