## 技术栈

| 领域       | 选型                                                |
| ---------- | --------------------------------------------------- |
| 前端框架   | Svelte 5                                            |
| 构建       | Vite 8                                              |
| 语言       | TypeScript 6                                        |
| 样式       | Tailwind CSS 4                                      |
| PWA        | vite-plugin-pwa（Workbox 预缓存应用壳）             |
| Worker RPC | Comlink（主线程 ↔ 存储/扩展 Worker）                |
| 桌面壳     | Tauri 2（自定义 Rust 命令承载存储；窗口状态插件）   |
| 单元测试   | Vitest（前端）+ cargo test（Rust 侧）               |
| 端到端测试 | Playwright（Chromium，验证 PWA 关键路径）           |
| 代码规范   | ESLint + Prettier（Rust 侧 rustfmt + clippy）       |
| 包管理     | pnpm 11                                             |
| Rust       | stable 工具链（桌面壳；wasm 目标供阶段 5 Agent 等） |

## 开发环境

- **Node.js** ≥ 22（当前开发基线 v24）
- **pnpm** 11（版本由 package.json 的 `packageManager` 字段锁定，建议经 corepack 启用）
- **Rust stable 工具链**（桌面壳；Windows 需 MSVC 生成工具，各平台前置依赖见 Tauri 官方文档）
- 只做 PWA 与内置扩展开发时可不装 Rust；桌面壳（`pnpm tauri dev`）需要。

## 常用命令

| 命令                | 用途                                                    |
| ------------------- | ------------------------------------------------------- |
| `pnpm dev`          | 启动开发服务器                                          |
| `pnpm build`        | 构建 PWA 到 `dist/`                                     |
| `pnpm preview`      | 预览构建产物                                            |
| `pnpm check`        | svelte-check + tsc 类型检查                             |
| `pnpm test`         | Vitest 单元测试（`tests/`）                             |
| `pnpm test:e2e`     | Playwright e2e（`e2e/`；自动构建并以 preview 起服务）   |
| `pnpm test:watch`   | Vitest watch 模式                                       |
| `pnpm lint`         | ESLint                                                  |
| `pnpm format`       | Prettier 格式化                                         |
| `pnpm format:check` | Prettier 检查                                           |
| `pnpm tauri dev`    | 桌面壳开发（编译 Rust 并开窗，前端走 Vite 热更新）      |
| `pnpm tauri build`  | 桌面壳打包（产物在 `src-tauri/target/release/bundle/`） |

## 测试约定

- 单元测试位于 `tests/`，由 Vitest 运行（`vite.config.ts` 中 `include: tests/**`），覆盖 domain / grid / storage / host 等纯逻辑。
- Rust 侧单测内联于 `src-tauri/src/` 各模块（`#[cfg(test)]`），由 `cargo test` 运行，覆盖存储命令的纯函数助手。
- 端到端测试位于 `e2e/`，由 Playwright 运行，主要经 Chromium 覆盖 Onboarding、网格交互、日记、OPFS 持久化等关键路径；Tauri 侧验证以单测 + 手测冒烟为主。

## CI 与发布

- CI（`.github/workflows/ci.yml`）：push / PR 到 `main` 触发，两个并行 job——前端（lint、format:check、check、vitest、build）与 Rust（cargo fmt / clippy / check / test）。e2e 不进 CI，本地手动跑。
- 发布（`.github/workflows/release.yml`）：推送 `v*` tag 触发，构建 Windows NSIS 安装包并直接发布 GitHub Release；tag 带 `-alpha` / `-beta` / `-rc` 等后缀时自动标记为 pre-release。
- 发版前把三处版本号同步改为 tag 对应版本：`package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`。
