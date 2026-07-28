# 扩展系统设计 Plan

把 30kdays 从「四功能一体的 PWA」演进为「**核心 + 内置扩展**」架构：核心只保留人生日历网格 + 按天日记，todo / memo / wakapi 全部作为扩展存在（含内置）。同时新增桌面壳（Tauri 2），与 PWA 壳共用同一前端代码库。本文是讨论确认后的决策记录与阶段 1 执行清单。

---

## 1. 已确认决策

| # | 决策 | 选择 | 理由 |
|---|------|------|------|
| 1 | 桌面壳 | Tauri 2（Rust 后端 + 系统 webview） | 体积小、内存轻；Rust 侧可干净地起同步 server、管 FS、提供平台能力。PWA 同时保留。 |
| 2 | 扩展形态 | WASM（Rust 编写） | 跨壳一致（PWA 也能跑扩展）；沙箱干净；和 Tauri 的 Rust 技术栈同源。 |
| 3 | 前端复用 | 单一前端代码库 `src/`，PWA 壳与 Tauri 壳共享 | 现有分层（domain/grid/storage 接口框架无关）已为此铺路。 |
| 4 | 核心瘦身 | 本体只留「人生日历网格 + 按天日记」；todo / memo 变为内置扩展 | 核心变纯，扩展系统被真实功能验证，wakapi 等新数据源有归宿。 |
| 5 | 扩展点 MVP 范围 | 视图 tab / 编辑器弹层 / 格子覆盖渲染 / 设置 UI 注入 / 网络 / 配置存储 / 通用文档存储 / 存储后端注册 | 由「todo / memo 必须能作为扩展重建全部能力」反推得出，无法再砍。 |
| 6 | 落地节奏 | 分阶段 1→2→3 | 每阶段一个真实扩展当试金石，契约被真实需求验证，避免空头设计。 |
| 7 | 阶段 1 期间 todo | 暂留核心，阶段 2 再剥离 | 避免功能回退；先把扩展契约跑通再迁 todo。 |
| 8 | 扩展视图层 | 混合：wasm 跑逻辑 + Svelte 视图 | Rust 写 UI 痛苦；视图复用现有 Svelte 组件，逻辑在 wasm 沙箱。视图通过白名单 host API 访问数据。 |
| 9 | 运行时模型 | 三层：Svelte 视图(主线程) ↔ 扩展 wasm(Web Worker, Comlink) ↔ 宿主能力(wasm-bindgen host imports) | 复用现有 comlink 依赖与 `worker.ts` 模式；跨壳一致。 |
| 10 | 扩展 wasm 运行位置 | PWA 与 Tauri 都在 webview 的 Web Worker 跑 wasm | 保跨壳一致；Tauri Rust 后端不加载扩展 wasm，只提供平台能力。 |
| 11 | manifest 格式 | JSON | 通用、两端可读。 |
| 12 | 扩展包结构 | `extensions/<id>/`：`manifest.json` + `logic.wasm` + `views/*.svelte` | 内置扩展随仓库发布。 |
| 13 | 视图组件加载 | 动态 `import()` 按需加载 | 减少首屏体积。 |
| 14 | 权限模型 | 粗粒度能力字符串（`doc:read` / `doc:write` / `net:fetch` / `grid:overlay` …） | 简单可控，需求明确后再细化；内置扩展权限默认授予且不可禁用。 |

---

## 2. 全局架构

```
┌──────────────────────────────────────────────────────┐
│  单一前端代码库 (src/)                                 │
│  domain / grid / ui(Svelte) / storage(接口)           │
│  ┌──────────────────────────────────────────────┐    │
│  │ ExtensionHost (新增, 接口)                     │    │
│  │  - 扫描扩展 / 加载 manifest / 实例化 worker    │    │
│  │  - 注入 host API / 注册 contributes           │    │
│  └──────────────────────────────────────────────┘    │
└────────────────────────┬─────────────────────────────┘
                         │ 注入平台能力（StorageBackend / Net / FS）
┌────────────────────────┼─────────────────────────────┐
│ PWA 壳 (浏览器)        │ Tauri 壳 (桌面)               │
│  OpfsBackend          │  NativeBackend (Rust FS)      │
│  FsAccessBackend     │  + 本地同步 WS server + mDNS   │
│  Worker 跑扩展 wasm   │  Worker 跑扩展 wasm           │
└────────────────────────┴─────────────────────────────┘
```

### 核心瘦身后的边界

- **核心保留**：`domain/lifeConfig`、`domain/dayIndex`、`grid/*`、`storage/StorageBackend`（接口）+ `OpfsBackend`/`FsAccessBackend`、`ui/App.svelte`（改扩展驱动壳）、`ui/CalendarView`/`ui/GridView`/`ui/DayEditor`/`ui/Onboarding`/`ui/SettingsView`/`ui/SideNav`（改扩展注册）、`lib/storageService`（移除 todo/memo 专用方法）。
- **核心移除 → 内置扩展**：`domain/todo`、`domain/memo`、`stores/todos`、`stores/memos`、`ui/TodoView`/`TodoEditor`/`MemoView`（阶段 1/2 分别迁移）。
- **解耦点**：`App.svelte` 当前硬编码四视图 + `SideNav` 硬编码四 tab + `router.ts` 硬编码 `VIEWS`，全部改为扩展驱动（动态构成）。`CalendarView` 当前通过 `getDayFlags` 注入 `FLAG_HAS_TODO`（App.svelte:31-33,128-130 调 `deadlineDayIndices`），阶段 2 改为格子覆盖渲染扩展点。

---

## 3. 扩展包结构与 manifest

```
extensions/memo/
├── manifest.json
├── logic.wasm          # Rust 编译，wasm-bindgen，跑在 Web Worker
├── views/
│   └── MemoView.svelte
└── assets/
```

### manifest schema（阶段 1 子集）

```jsonc
{
  "id": "memo",                       // 全局唯一，唯一性校验
  "name": "备忘",
  "version": "1.0.0",
  "main": "logic.wasm",
  "permissions": ["doc:read", "doc:write"],
  "contributes": {
    "views": [
      {
        "id": "memos",
        "label": "备忘",
        "icon": "note",
        "component": "views/MemoView.svelte"
      }
    ]
    // 阶段 2 追加: dayEditorTools, gridOverlays
    // 阶段 3 追加: settings
  }
}
```

- 阶段 2/3 追加的 `contributes` 字段：

  ```jsonc
  "dayEditorTools": [{ "id": "...", "slot": "toolbar", "component": "..." }],
  "gridOverlays":  [{ "id": "...", "z": 10 }],
  "settings":      [{ "id": "...", "label": "...", "component": "..." }]
  ```

### 加载流程

1. 宿主启动 → 扫描扩展来源（PWA：内置清单 + IndexedDB 注册表；Tauri：内置清单 + 用户扩展目录）。
2. 逐个读 `manifest.json` → 校验 `id` 唯一、`permissions` 声明。
3. 为每个扩展起一个 Web Worker → `WebAssembly.instantiateStreaming` 加载 `logic.wasm`，注入 host imports。
4. 用 Comlink 把 worker 里的 wasm API 代理到主线程。
5. 按 `contributes` 注册到各扩展点（SideNav tab、路由、视图组件懒加载映射）。
6. 用户切到某 view 时，动态 `import()` 对应 Svelte 组件。

---

## 4. 运行时与 IPC

```
┌──────────────────────────────────────────────┐
│ Svelte 视图 (主线程)                          │
│  - 通过 Comlink 代理调扩展逻辑方法           │
│  - 通过 host.* 白名单 API 访问能力           │
└──────────────┬───────────────────────────────┘
               │ Comlink（已依赖，沿用 worker.ts 模式）
               ▼
┌──────────────────────────────────────────────┐
│ 扩展 wasm 逻辑 (Web Worker)                  │
│  - wasm-bindgen 绑定，纯计算 + 调度，无 I/O   │
│  - 通过 wasm imports 调宿主能力              │
└──────────────┬───────────────────────────────┘
               │ wasm-bindgen host imports（extern fn → 宿主实现）
               ▼
┌──────────────────────────────────────────────┐
│ 宿主能力层                                   │
│  - PWA：主线程 JS（OPFS/FsAccess）           │
│  - Tauri：Rust 后端（FS/同步 server）        │
└──────────────────────────────────────────────┘
```

- 异步：`wasm-bindgen-futures` 让 wasm 能 `await` 宿主返回的 promise；`doc.read` 等 async API 直接可用。
- 沙箱边界：wasm 默认无 I/O，所有能力必须经 host imports 注入；视图层（Svelte）能碰 DOM，但碰不了未授权存储/网络——所有数据访问走白名单 `host.*`。

---

## 5. host API 第一版清单（阶段 1）

| 能力 | 方法 | 权限串 | 备注 |
|---|---|---|---|
| 文档读写 | `host.doc.read(name): Promise<T\|null>` / `host.doc.write(name, data): Promise<void>` | `doc:read` / `doc:write` | 复用 `StorageBackend.readDoc/writeDoc`。memo 用 `memos.json`。 |
| 日历格子查询 | `host.grid.getDayMeta(index): Promise<DayMeta>` | `grid:read` | 给扩展提供格子上下文（日期、flags、是否有内容）。阶段 2 起用。 |
| 日志 | `host.log.info(msg)` / `host.log.warn(msg)` | 无 | 调试用，写入宿主 console。 |
| 配置 | `host.config.get(key)` / `host.config.set(key, val)` | `config:read` / `config:write` | 扩展私有配置（key 命名空间 `ext:<id>:*`）。阶段 3 起用。 |
| 网络 | `host.net.fetch(url, opts): Promise<Response>` | `net:fetch` | 阶段 3 起；URL 白名单由 manifest 声明（如 wakapi 实例域）。 |

- 阶段 1 只需落地 `doc.*` + `log.*`。
- `grid.overlay`（格子覆盖渲染）、`dayEditor.tool`（编辑器工具栏）、`settings` 等扩展点的 host API 在阶段 2/3 设计。

---

## 6. 阶段划分

### 阶段 1：核心瘦身 + 扩展 host 基建 + memo 内置扩展

**交付**：
- 核心瘦身完成（todo 暂留，仅移除 memo 专用的 storageService 方法 / 路由 / SideNav 项）。
- `ExtensionHost` 接口 + PWA 壳实现（扫描、manifest、Worker、Comlink、host imports 注入、contributes 注册）。
- `extensions/memo/` 内置扩展（wasm 逻辑 + Svelte 视图），功能与现状等价。
- App.svelte / SideNav / router 改为扩展驱动；memo 走扩展，todo 仍硬编码（暂留）。
- host API：`doc.*` + `log.*`。
- 测试：扩展加载流程 + memo 扩展端到端读写。

**新增扩展点契约**：视图 tab 注册（`contributes.views`）。

**验证里程碑**：卸载/启用 memo 扩展，备忘录功能随之消失/恢复；功能与重构前一致。

### 阶段 2：todo 内置扩展

**交付**：
- 把 todo 从核心完全剥离到 `extensions/todo/`。
- 新增扩展点契约：编辑器弹层注册（`contributes.dayEditorTools`）、格子覆盖渲染（`contributes.gridOverlays`）。
- host API：`grid.*`（含双模式覆盖渲染契约，见 §7）。
- todo 的截止日标记改走格子覆盖渲染扩展点（替换当前 `FLAG_HAS_TODO` 注入）。
- 阶段 1 暂留的 todo 硬编码全部移除。

**验证里程碑**：禁用 todo 扩展，日历上的截止日标记消失；启用后恢复。

### 阶段 3：wakapi 扩展 + 同步

**交付**：
- `extensions/wakapi/`：拉 wakapi REST API（每日各语言/项目编程时长），在日历格子上画编程时长热力。
- 新增扩展点契约：设置 UI 注入（`contributes.settings`）。
- host API：`net.fetch`（URL 白名单）、`config.*`（密钥存储）。
- 桌面壳（Tauri 2）接入：NativeBackend + 本地同步 WS server + mDNS 广播；PWA 作为同步 client 连桌面端。
- 数据同步语义：CRDT（Yjs/Automerge）或字段级 LWW + tombstone（待阶段 3 开工时按当时数据模型细化）。

**验证里程碑**：配置 wakapi 实例 + API key 后，日历格子显示每日编程时长热力；桌面端与 PWA 间数据同步。

---

## 7. 格子覆盖渲染扩展点契约（阶段 2 起，先记录约束）

grid 渲染管线（`src/grid/gridCanvas.ts`）有双模式，扩展点必须同时适配：

- **全景模式**（cellScreenSize < 12px，`renderOverview.ts` 画 `cols×rows` 的 `ImageData`）：扩展对每格返回「颜色或强度值」，宿主混入位图像素。扩展无法画任意形状，只能改色。
- **细节模式**（cellScreenSize ≥ 12px，`renderDetail.ts` 逐格画）：扩展对每个可见格子返回「绘制指令列表」（声明式，如 `{type:'dot', anchor, r, color}` / `{type:'fill', alpha}` / `{type:'text', text, color, font}`），宿主执行。

选「声明式指令集」而非「扩展直接拿 canvas context」：WASM 沙箱里拿不到 JS canvas context；声明式让扩展纯计算返回数据、宿主绘制，沙箱边界干净，跨壳一致。

具体指令集 schema 留到阶段 2 开工时定稿。

---

## 8. 阶段 1 执行清单

### 8.1 核心瘦身（保留 todo 暂留）

- `src/lib/storageService.ts`：移除 `loadTodos/saveTodos/loadMemos/saveMemos`（todos 暂留方法保留，阶段 2 一并移除）；核心只剩通用 `readDoc/writeDoc`。
- `src/ui/App.svelte`：移除 memo 直接 import；memo 视图改由 ExtensionHost 注册。
- `src/ui/SideNav.svelte`：`items` 改为「核心固定项（calendar/settings）+ 扩展注册项」合并。
- `src/stores/router.ts`：`VIEWS` 改为「核心项 + 扩展项」动态合并；`parseRoute` 校验扩展路由。
- `src/domain/memo.ts`、`src/stores/memos.ts`、`src/ui/MemoView.svelte`：迁到 `extensions/memo/`（logic 用 Rust 重写 CRUD 调度，视图直接搬 Svelte 组件）。

### 8.2 扩展 host 基建

新增目录 `src/extensions/`（核心侧的 host 框架，与 `extensions/<id>/` 内置扩展包区分）：

- `src/extensions/types.ts`：`ExtensionManifest`、`ExtensionContribution`、`HostApi` 类型。
- `src/extensions/host.ts`：`ExtensionHost` 类——扫描、加载、实例化 worker、注入 host imports、注册 contributes、生命周期（enable/disable/uninstall）。
- `src/extensions/worker.ts`：每个扩展起的 Worker 入口，加载 wasm、Comlink 暴露 wasm API、转发 host imports 到主线程。
- `src/extensions/registry.ts`：已加载扩展的注册表（id → manifest + worker + contributes 句柄）。
- `src/extensions/loader.ts`：manifest 读取、校验、权限授予（内置扩展自动授予）。

### 8.3 视图扩展点（阶段 1 唯一扩展点）

- `contributes.views` 注册到 `SideNav` tab + `router` 路由 + 视图组件懒加载映射。
- 切到扩展 view 时，动态 `import()` 扩展包里的 Svelte 组件挂载到 `App.svelte` 的视图容器。
- 视图组件 props 注入 `host` 对象（白名单 API）+ Comlink 代理的扩展 logic API。

### 8.4 memo 内置扩展

- `extensions/memo/manifest.json`：`permissions: ["doc:read","doc:write"]`，`contributes.views` 一个 `memos` 视图。
- `extensions/memo/logic.wasm`：Rust 实现 memo CRUD（读 `memos.json`、按 `updatedAt` 排序、增删改）。
- `extensions/memo/views/MemoView.svelte`：从 `src/ui/MemoView.svelte` 搬迁，存储调用从 `stores/memos` 改为 `host.doc.*` + Comlink 调 wasm logic。
- 构建集成：Vite 把 `extensions/*/logic.wasm` 与 `views/*.svelte` 一并产出；`@tauri-apps` 与 PWA 壳各自加载同一份产物。

### 8.5 测试

- `tests/extensions/loader.test.ts`：manifest 解析、id 唯一性、权限授予。
- `tests/extensions/host.test.ts`：mock 一个最小扩展，验证扫描→加载→注册→视图挂载流程。
- `tests/extensions/memo.e2e.test.ts`：mock 后端，验证 memo 扩展读 `memos.json` → 列表渲染 → 增删改 → 落盘往返。
- 现有 domain / grid / storage 测试不动，确保核心瘦身不回归。

### 8.6 不在阶段 1 范围

- Tauri 壳本身（阶段 3 接入；阶段 1 只在 PWA 壳跑扩展，但 host 接口设计成壳无关）。
- 格子覆盖渲染 / 编辑器弹层 / 设置 UI / 网络 / 配置（阶段 2/3）。
- todo 剥离（阶段 2）。
- 同步（阶段 3）。
- 第三方扩展安装 UI（内置扩展够用先不做）。

---

## 9. 风险与开放问题

- **wasm-bindgen + Comlink 三层异步链路**需先做一个 spike 验证：Comlink 代理的 wasm 方法 → wasm 内 `await` host imports → host 返回 promise 是否全程通畅。阶段 1 第一周做这个 spike，跑通再铺开。
- **视图组件的权限边界**：视图层能碰 DOM，靠白名单 `host.*` 收住数据访问；若视图层要直接 `fetch`/读 FS，必须经 `host.net`/`host.fs`，否则视为越权拒绝。需要宿主侧的运行时拦截（阶段 1 先靠约定，运行时强校验后置）。
- **动态 import 扩展 Svelte 组件的构建产物路径**：Vite 要把 `extensions/*/views/*.svelte` 当作可动态 import 的入口打包，manifest 里的 `component` 路径需与 Vite 产物对齐。可能需要自定义 Vite 插件扫描 manifest 生成入口清单。
- **Rust 工具链**：仓库引入 `wasm32-unknown-unknown` target + `wasm-bindgen` 构建。新增 `extensions/memo/Cargo.toml` + 构建脚本（`wasm-pack build` 或 `wasm-bindgen-cli`）。`pnpm build` 要先编 wasm 再起 Vite。
- **内置扩展的 hot reload**：dev 模式下 wasm 改动需重编 + worker 重启；Svelte 视图可走 Vite HMR。先保证视图 HMR，wasm 改动手动重启 worker。
- **同步语义**：当前数据模型写入全是整文件覆盖，无版本/updatedAt/tombstone（`Todo` 甚至没 `updatedAt`）。阶段 3 做同步前必须先给 domain 加版本字段 + tombstone。这个改造留到阶段 3，但阶段 2 剥离 todo 时可顺手给 todo 补 `updatedAt`，为阶段 3 减负。
- **design.md §1 的「非目标」需同步修订**：原 design.md 把「无后端、无实时跨设备同步」「不用 Rust」「不做原生壳打包」列为非目标。本 plan 把这三项移出非目标。开工前应同步更新 design.md（或在此 plan 顶部声明它是对 design.md 非目标章节的修订）。
