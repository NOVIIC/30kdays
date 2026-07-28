import * as Comlink from 'comlink'
import type { HostApi } from './types'

/**
 * 扩展 worker 通用入口。
 *
 * 流程：
 *  1. 主线程经 Comlink 调 load(glueUrl, host)
 *  2. 把 host 能力挂到 globalThis（wasm 的 extern "C" 从 globalThis 查找）
 *  3. 动态 import wasm glue（wasm-pack --target web 产出的 ESM）
 *  4. 调 glue 的 default init() 实例化 wasm
 *  5. 把 wasm 导出的方法挂到 ext，主线程经 Comlink proxy 即可调用
 *
 * wasm 导出方法名因扩展而异，类型上无法静态枚举；视图层取 logic 时
 * 用具体扩展的接口断言（见阶段 1 第二步 memo 接线）。
 * spike（spikes/wasm-comlink）已验证 wasm→host extern + JsFuture 回流链路。
 */
const ext: { load: (glueUrl: string, host: HostApi) => Promise<void> } = {
  async load(glueUrl, host) {
    const g = globalThis as Record<string, unknown>
    g.host_doc_read = (name: string) => host.doc.read(name)
    g.host_doc_write = (name: string, data: unknown) => host.doc.write(name, data)
    g.host_log_info = (...args: unknown[]) => host.log.info(...args)
    g.host_log_warn = (...args: unknown[]) => host.log.warn(...args)

    const mod = (await import(/* @vite-ignore */ glueUrl)) as {
      default: () => Promise<void>
    } & Record<string, unknown>
    await mod.default()
    Object.assign(ext, mod)
  },
}

export type ExtensionWorker = typeof ext
Comlink.expose(ext)
