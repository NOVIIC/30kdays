/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

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
        name: '人生日历 - 30kdays',
        short_name: '30kdays',
        description: '把一生按天铺成网格',
        theme_color: '#16171d',
        background_color: '#16171d',
        display: 'standalone',
        orientation: 'any',
        icons: [],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '$lib': resolve(__dirname, 'src/lib'),
    },
  },
  test: {
    include: ['tests/**/*.{test,spec}.ts'],
  },
})
