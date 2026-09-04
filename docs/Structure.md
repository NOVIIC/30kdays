## 代码结构说明

下面是完整的代码目录结构以及各目录与文件的说明

各文件内包含精确到函数的代码功能注释

## 目录结构

下面是按 ARCHITECTURE.md 规划的目标目录结构；标记「⏳」的目录属于未开始的阶段，随开发推进建立。已省略 `node_modules/`、`dist/` 等生成目录。

```text
/
├── docs/                  # 持久化文档（理念、结构、开发环境、扩展系统设计）
├── public/                # 不经打包的静态资源（favicon、PWA 图标 icons/ 等）
├── scripts/               # 构建辅助脚本（gen-icons.mjs 生成图标；sync-version.mjs 同步版本号到 Cargo.toml）
├── src/                   # 共享前端：PWA 与 Tauri webview 共用同一套代码
│   ├── core/               # 核心层：不依赖 UI 的可复用模块
│   │   ├── domain/         # 核心领域纯逻辑：人生配置、日期 ↔ 日索引、日记模型
│   │   ├── grid/           # 人生网格：布局、相机、Canvas 渲染、命中检测
│   │   ├── storage/        # 存储抽象与各壳后端（backend.ts 接口；opfs-store / tauri-store 实现）
│   │   └── host/           # Extension Host：manifest、权限、Worker、派发点/中间件链、Host API
│   ├── stores/             # 前端状态：配置、主题、路由、存储状态等
│   └── ui/                 # Svelte 界面：壳、Onboarding、日历、日记、设置
├── extensions/            # 内置扩展包，构建期静态注册；memo、todo 已落地（各自 src/ 下领域纯函数
│                          #   与列表状态/防抖保存、views/ 下主视图；todo 另含 src/overlay.ts 覆盖层
│                          #   provider 与 views/DayTodosTool.svelte 日记工具，分别经 Host 的
│                          #   gridOverlays / dayEditorTools 派发点接入核心）
├── src-tauri/             # 桌面壳（Tauri 2）：src/storage.rs 存储命令；窗口状态持久化；数据落在应用数据目录
├── crates/ ⏳阶段 5       # 宿主侧可共享的 Rust 库（Agent 宿主接口等；届时升级为根 Cargo workspace）
├── tests/                 # 单元测试（Vitest；domain / grid / storage / host / stores / extensions）
└── e2e/                  # 端到端测试（Playwright，核心闭环 + memo 用例）
```
