/**
 * PWA 图标生成：从 public/favicon.svg 渲染安装清单所需的 PNG。
 * 产物写入 public/icons/：
 *   pwa-192.png      192×192  安装清单小图标
 *   pwa-512.png      512×512  安装清单大图标 / 启动屏
 *   maskable-512.png 512×512  Android 自适应图标（内容缩进 80% 安全区，底色铺满）
 * 用法：pnpm icons（更换 favicon.svg 后重跑）。
 */

import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const SRC = fileURLToPath(new URL('../public/favicon.svg', import.meta.url))
const OUT_DIR = fileURLToPath(new URL('../public/icons/', import.meta.url))
const out = (file) => fileURLToPath(new URL(`../public/icons/${file}`, import.meta.url))

/** 图标底色，与 favicon.svg 的纸张底色一致（maskable 需整幅铺满）。 */
const BG = '#f4f0e8'

/** 以足够高的 DPI 光栅化 SVG 后缩放到目标尺寸，避免先小图栅格化再放大失真。 */
function raster(size) {
  // favicon.svg 视窗 32 单位；density 72 时输出 32px，按比例放大到目标尺寸
  return sharp(SRC, { density: Math.ceil((size / 32) * 72) }).resize(size, size)
}

/** 生成普通图标：整幅渲染。 */
async function icon(file, size) {
  await raster(size).png().toFile(out(file))
  console.log(`✓ ${file} (${size}×${size})`)
}

/** 生成 maskable 图标：内容限制在 80% 安全区内，底色铺满整幅。 */
async function maskable(file, size) {
  const inner = Math.round(size * 0.8)
  const fg = await raster(inner).png().toBuffer()
  await sharp({ create: { width: size, height: size, channels: 3, background: BG } })
    .composite([{ input: fg, gravity: 'center' }])
    .png()
    .toFile(out(file))
  console.log(`✓ ${file} (${size}×${size}, 安全区 80%)`)
}

await mkdir(OUT_DIR, { recursive: true })
await icon('pwa-192.png', 192)
await icon('pwa-512.png', 512)
await maskable('maskable-512.png', 512)
