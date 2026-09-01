/**
 * 内存假 OPFS：FileSystemDirectoryHandle / FileSystemFileHandle 的最小实现，
 * 仅供单测注入 createOpfsStore，覆盖真实 OPFS 的行为契约（NotFoundError、
 * create 选项、createWritable 两段式写入、removeEntry）。
 */

/** 文件节点：内容为字节序列。 */
type FakeFileNode = { kind: 'file'; data: Uint8Array }

/** 目录节点：名称 → 子节点。 */
type FakeDirNode = { kind: 'dir'; children: Map<string, FakeFileNode | FakeDirNode> }

/** 构造与真实 OPFS 一致的 NotFoundError。 */
function notFound(name: string): DOMException {
  return new DOMException(`不存在：${name}`, 'NotFoundError')
}

/** 把写入块统一转成字节（对应真实 FileSystemWritableFileStream 的入参类型）。 */
async function chunkToBytes(chunk: string | Blob | Uint8Array): Promise<Uint8Array> {
  if (typeof chunk === 'string') return new TextEncoder().encode(chunk)
  if (chunk instanceof Blob) return new Uint8Array(await chunk.arrayBuffer())
  return chunk
}

/** 内存假 FileSystemFileHandle：getFile / createWritable。 */
class FakeFileHandle {
  readonly kind = 'file'

  constructor(private readonly node: FakeFileNode) {}

  /** 读取文件内容，包装为 File（与真实 OPFS 返回类型一致）。 */
  async getFile(): Promise<File> {
    return new File([new Uint8Array(this.node.data)], 'file')
  }

  /** 创建写入流：write 缓存数据，close 时一次性提交。 */
  async createWritable(): Promise<{
    write: (chunk: string | Blob | Uint8Array) => Promise<void>
    close: () => Promise<void>
  }> {
    const chunks: Uint8Array[] = []
    return {
      write: async (chunk) => {
        chunks.push(await chunkToBytes(chunk))
      },
      close: async () => {
        const total = chunks.reduce((n, c) => n + c.length, 0)
        const data = new Uint8Array(total)
        let offset = 0
        for (const c of chunks) {
          data.set(c, offset)
          offset += c.length
        }
        this.node.data = data
      },
    }
  }
}

/** 内存假 FileSystemDirectoryHandle：getDirectoryHandle / getFileHandle / removeEntry。 */
class FakeDirectoryHandle {
  readonly kind = 'directory'

  constructor(private readonly node: FakeDirNode) {}

  /** 取得子目录句柄；create 为 true 时缺失即创建，否则抛 NotFoundError。 */
  async getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<FakeDirectoryHandle> {
    let child = this.node.children.get(name)
    if (child === undefined) {
      if (!options?.create) throw notFound(name)
      child = { kind: 'dir', children: new Map() }
      this.node.children.set(name, child)
    }
    if (child.kind !== 'dir') throw notFound(name)
    return new FakeDirectoryHandle(child)
  }

  /** 取得文件句柄；create 为 true 时缺失即创建，否则抛 NotFoundError。 */
  async getFileHandle(name: string, options?: { create?: boolean }): Promise<FakeFileHandle> {
    let child = this.node.children.get(name)
    if (child === undefined) {
      if (!options?.create) throw notFound(name)
      child = { kind: 'file', data: new Uint8Array(0) }
      this.node.children.set(name, child)
    }
    if (child.kind !== 'file') throw notFound(name)
    return new FakeFileHandle(child)
  }

  /** 删除子项；不存在抛 NotFoundError。recursive 选项与真实 OPFS 对齐（内存实现天然整树删除）。 */
  async removeEntry(name: string, _options?: { recursive?: boolean }): Promise<void> {
    if (!this.node.children.delete(name)) throw notFound(name)
  }

  /** 异步迭代目录条目，与真实 FileSystemDirectoryHandle.entries() 一致。 */
  async *entries(): AsyncIterableIterator<[string, FakeDirectoryHandle | FakeFileHandle]> {
    for (const [name, child] of this.node.children) {
      yield [
        name,
        child.kind === 'dir' ? new FakeDirectoryHandle(child) : new FakeFileHandle(child),
      ]
    }
  }
}

/** 创建内存假 OPFS 根目录，可直接注入 createOpfsStore。 */
export function createFakeOpfsRoot(): FileSystemDirectoryHandle {
  const root: FakeDirNode = { kind: 'dir', children: new Map() }
  return new FakeDirectoryHandle(root) as unknown as FileSystemDirectoryHandle
}
