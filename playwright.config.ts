import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright e2e 配置：仅 Chromium，跑构建产物的 preview（贴近生产，含 SW）。
 * 用例在 e2e/ 下，每个测试独立浏览器上下文（OPFS 等存储相互隔离）。
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm build && pnpm preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
