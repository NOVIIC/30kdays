 ## 代码结构说明

 下面是完整的代码目录结构以及各目录与文件的说明

 在各文件有对代码的功能注释

 ## 目录结构

 下面是按 ARCHITECTURE.md 规划的目标目录结构；标记「⏳」的目录属于未开始的阶段，随开发推进建立。已省略 `node_modules/`、`dist/` 等生成目录。

 ```text
 /
 ├── docs/                  # 持久化文档（理念、结构、开发环境、扩展系统设计）
 ├── public/                # 不经打包的静态资源（favicon 等）
 ├── src/                   # 共享前端：PWA 与 Tauri webview 共用同一套代码
 │   ├── core/               # 核心层：不依赖 UI 的可复用模块
 │   │   ├── domain/         # 核心领域纯逻辑：人生配置、日期 ↔ 日索引、日记模型
 │   │   ├── grid/           # 人生网格：布局、相机、Canvas 渲染、命中检测
 │   │   ├── storage/        # 存储抽象与各壳后端（PWA: OPFS；桌面: 本地目录）
 │   │   └── host/           # Extension Host：manifest、权限、Worker、派发点/中间件链、Host API
 │   ├── stores/             # 前端状态：配置、主题、路由、存储状态等
 │   └── ui/                 # Svelte 界面：壳、Onboarding、日历、日记、设置
 ├── extensions/ ⏳阶段 2   # 内置扩展包（memo、todo），随主应用发布
 ├── src-tauri/ ⏳阶段 3    # 桌面壳：FS、同步汇合、Agent 运行时挂载、外部扩展目录
 ├── crates/ ⏳阶段 3+      # 宿主侧可共享的 Rust 库（Agent 宿主接口等）
 ├── tests/                 # 单元测试（Vitest；domain / grid 等）
 └── e2e/ ⏳阶段 1          # 端到端测试（Playwright）
 ```