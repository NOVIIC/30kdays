/**
 * 版本号同步：以 package.json 为单一来源，把版本写进 src-tauri/Cargo.toml。
 * tauri.conf.json 缺省回退 Cargo.toml；Cargo.lock 由 cargo 构建时自动跟进。
 * 用法：改 package.json 的 version 后执行 `pnpm sync-version`。
 */

import { readFileSync, writeFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const version = pkg.version
if (typeof version !== 'string' || version.length === 0) {
  throw new Error('package.json 缺少 version 字段')
}

const cargoPath = 'src-tauri/Cargo.toml'
const cargo = readFileSync(cargoPath, 'utf8')
// 只替换 [package] 段内第一处 version（依赖段不含顶层 version 单行写法；行尾可能是 CRLF）
const versionLine = /^version = "[^"]*"/m
if (!versionLine.test(cargo)) {
  throw new Error(`${cargoPath} 中未找到 [package] 的 version 行`)
}
writeFileSync(cargoPath, cargo.replace(versionLine, `version = "${version}"`))
console.log(`已同步版本 ${version} → ${cargoPath}`)
