import * as Comlink from 'comlink'
import { storageService } from '../lib/storageService'
import { builtinExtensions } from './builtin'
import { fetchManifest } from './loader'
import { Registry } from './registry'
import type { ExtensionManifest, ExtensionOrigin, ExtensionMeta, HostApi } from './types'
import type { ExtensionWorker } from './worker'

/**
 * 扩展宿主：扫描、加载、实例化 worker、注入 host API、注册 contributes。
 *
 * 阶段 1 只在 PWA 壳跑；host 接口设计成壳无关，阶段 3 Tauri 壳复用。
 */
export class ExtensionHost {
  private workers = new Map<string, Worker>()
  private logic = new Map<string, Comlink.Remote<ExtensionWorker>>()
  readonly registry = new Registry()

  private hostApi: HostApi = {
    doc: {
      read: <T>(name: string) => storageService.readDoc<T>(name),
      write: <T>(name: string, data: T) => storageService.writeDoc<T>(name, data),
    },
    log: {
      info: (...args: unknown[]) => console.log('[ext]', ...args),
      warn: (...args: unknown[]) => console.warn('[ext]', ...args),
    },
  }

  /** 加载所有内置扩展（失败的不中断后续） */
  async loadBuiltin(): Promise<void> {
    for (const be of builtinExtensions) {
      try {
        await this.load(be.manifestUrl, 'builtin')
      } catch (e) {
        console.error(`[ext] failed to load builtin "${be.id}":`, e)
      }
    }
  }

  async load(manifestUrl: string, origin: ExtensionOrigin): Promise<ExtensionMeta> {
    const manifest: ExtensionManifest = await fetchManifest(manifestUrl)
    if (this.registry.has(manifest.id))
      throw new Error(`extension "${manifest.id}" already loaded`)

    // wasm glue URL 相对 manifest 解析（manifestUrl 可能是相对路径，需先转绝对）
    const base = new URL(manifestUrl, window.location.href)
    const glueUrl = new URL(manifest.main, base).href
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    const logic = Comlink.wrap<ExtensionWorker>(worker)
    await logic.load(glueUrl, Comlink.proxy(this.hostApi))

    this.workers.set(manifest.id, worker)
    this.logic.set(manifest.id, logic)

    const meta: ExtensionMeta = { manifest, origin, enabled: true }
    this.registry.add(meta)
    return meta
  }

  /** 取扩展的 logic 代理（视图层经此调 wasm 方法） */
  getLogic(id: string): Comlink.Remote<ExtensionWorker> | undefined {
    return this.logic.get(id)
  }

  async unload(id: string): Promise<void> {
    const w = this.workers.get(id)
    if (w) {
      w.terminate()
      this.workers.delete(id)
    }
    this.logic.delete(id)
    this.registry.remove(id)
  }
}

export const extensionHost = new ExtensionHost()
