import type { ExtensionManifest, ExtensionPermission } from './types'

const KNOWN_PERMISSIONS: readonly ExtensionPermission[] = [
  'doc:read',
  'doc:write',
  'grid:read',
  'grid:overlay',
  'net:fetch',
  'config:read',
  'config:write',
]

/** fetch + 校验 manifest */
export async function fetchManifest(url: string): Promise<ExtensionManifest> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch manifest ${url}: ${res.status}`)
  return validateManifest(await res.json())
}

/** 校验 manifest 结构与权限声明，返回类型化的 manifest */
export function validateManifest(raw: unknown): ExtensionManifest {
  if (typeof raw !== 'object' || raw === null) throw new Error('manifest: not an object')
  const m = raw as Record<string, unknown>
  requireString(m, 'id')
  requireString(m, 'name')
  requireString(m, 'version')
  requireString(m, 'main')
  if (!Array.isArray(m.permissions)) throw new Error('manifest: permissions must be array')
  for (const p of m.permissions) {
    if (!KNOWN_PERMISSIONS.includes(p as ExtensionPermission))
      throw new Error(`manifest: unknown permission "${String(p)}"`)
  }
  if (typeof m.contributes !== 'object' || m.contributes === null)
    throw new Error('manifest: contributes must be object')
  validateContributes(m.contributes as Record<string, unknown>)
  return raw as ExtensionManifest
}

function validateContributes(c: Record<string, unknown>): void {
  if (c.views !== undefined) {
    if (!Array.isArray(c.views)) throw new Error('manifest: contributes.views must be array')
    for (const v of c.views) {
      const vv = v as Record<string, unknown>
      for (const k of ['id', 'label', 'icon', 'component']) {
        if (typeof vv[k] !== 'string' || !vv[k]) throw new Error(`manifest: view.${k} missing`)
      }
    }
  }
}

function requireString(m: Record<string, unknown>, key: string): void {
  if (typeof m[key] !== 'string' || !m[key]) throw new Error(`manifest: ${key} missing`)
}
