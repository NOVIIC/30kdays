import * as Comlink from 'comlink'
import init, { add, read_doc_via_host } from './pkg/spike_wasm_comlink.js'

// 主线程注入的 host 实现（spike：mock；真实场景转发到 storageService）
type HostImpl = {
  docRead: (name: string) => Promise<unknown>
}

let hostImpl: HostImpl | null = null

// wasm 的 extern "C" host_doc_read 会从 globalThis 查找此函数
;(globalThis as unknown as Record<string, unknown>).host_doc_read = (
  name: string,
): Promise<unknown> => {
  if (!hostImpl) return Promise.reject(new Error('host not set'))
  return hostImpl.docRead(name)
}

const api = {
  async init() {
    await init()
  },
  add,
  readDocViaHost: read_doc_via_host,
  setHost(impl: HostImpl) {
    hostImpl = impl
  },
}

export type SpikeApi = typeof api
Comlink.expose(api)
