/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/** 是否处于 Tauri 构建/开发环境（tauri CLI 自动注入 TAURI_ENV_*）；桌面壳不启用 PWA。 */
const isTauri = !!process.env.TAURI_ENV_PLATFORM

// https://vite.dev/config/
export default defineConfig({
  // Tauri 要求 devUrl 固定可用：锁端口，且不因 CLI 输出清屏
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  plugins: [
    tailwindcss(),
    svelte(),
    // PWA 仅浏览器壳：桌面 webview 不需要 Service Worker 与安装清单
    ...(isTauri
      ? []
      : [
          VitePWA({
            registerType: 'autoUpdate',
            workbox: {
              globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
            },
            manifest: {
              name: '30kdays',
              short_name: '30kdays',
              description: '把一生按天铺成网格',
              lang: 'zh-CN',
              // 与 app.css 浅色 --bg 一致；运行中由 stores/theme 按生效主题动态改写 meta theme-color
              theme_color: '#f6f2e9',
              background_color: '#f6f2e9',
              display: 'standalone',
              orientation: 'any',
              icons: [
                {
                  src: '/icons/pwa-192.png',
                  sizes: '192x192',
                  type: 'image/png',
                  purpose: 'any',
                },
                {
                  src: '/icons/pwa-512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'any',
                },
                {
                  src: '/icons/maskable-512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'maskable',
                },
              ],
            },
          }),
        ]),
  ],
  test: {
    include: ['tests/**/*.{test,spec}.ts'],
  },
})
