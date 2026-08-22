## 技术栈

| 领域       | 选型                                                     |
| ---------- | -------------------------------------------------------- |
| 前端框架   | Svelte 5                                                 |
| 构建       | Vite 8                                                   |
| 语言       | TypeScript 6                                             |
| 样式       | Tailwind CSS 4                                           |
| PWA        | vite-plugin-pwa（Workbox 预缓存应用壳）                  |
| 桌面壳     | Tauri 2（⏳ 阶段 3 引入）                                |
| 单元测试   | Vitest                                                   |
| 端到端测试 | Playwright（⏳ 阶段 1 引入，Chromium 验证 PWA 关键路径） |
| 代码规范   | ESLint + Prettier                                        |
| 包管理     | pnpm                                                     |
| Rust       | stable 工具链（⏳ 阶段 3 起；含 wasm 目标，供 Agent 等） |

## 开发环境

- **Node.js** ≥ 22（当前开发基线 v24）
- **pnpm** ≥ 10（建议经 corepack 启用）
- 阶段 1–2（PWA 与内置扩展）仅需以上两项；内置扩展逻辑用 TS 编写，不需要 Rust。
- 阶段 3 起追加：**Rust stable 工具链**与 **Tauri 2 系统依赖**（各平台前置依赖见 Tauri 官方文档）。

## 常用命令

| 命令               | 用途                                     |
| ------------------ | ---------------------------------------- |
| `pnpm dev`         | 启动开发服务器                           |
| `pnpm build`       | 构建 PWA 到 `dist/`                      |
| `pnpm preview`     | 预览构建产物                             |
| `pnpm check`       | svelte-check + tsc 类型检查              |
| `pnpm test`        | Vitest 单元测试（`tests/`）              |
| `pnpm test:watch`  | Vitest watch 模式                        |
| `pnpm lint`        | ESLint                                   |
| `pnpm format`      | Prettier 格式化                          |
| `pnpm format:check`| Prettier 检查                            |

## 测试约定

- 单元测试位于 `tests/`，由 Vitest 运行（`vite.config.ts` 中 `include: tests/**`），覆盖 domain / grid 等纯逻辑。
- 端到端测试位于 `e2e/`，由 Playwright 运行，主要经 Chromium 覆盖 Onboarding、网格交互、日记、OPFS 持久化等关键路径；Tauri 侧 e2e 到阶段 3 再定。
