/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    svelte(),
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
  ],
  test: {
    include: ['tests/**/*.{test,spec}.ts'],
  },
})
