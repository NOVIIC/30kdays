# 30kdays

把一生按天铺成可缩放网格（约三万格）的本地优先应用：浏览器以 PWA 运行，桌面以 Tauri 运行；二者共用同一套前端。本体只负责人生日历与按天日记；待办、备忘等以扩展存在；更重的能力（如 WakaTime 兼容采集）以独立仓库的外部扩展提供。

---

## 1. 产品能力

1. 首次使用：选择生日与预期寿命，生成人生日索引与空数据。
2. 日历总览：全部格子贴合屏幕；滚轮/双指缩放、拖拽平移；点格打开当天日记（文字 + 图片）。
3. 过去 / 今天 / 未来 / 有内容用颜色区分；扩展可在格子上叠加标记（如待办截止点、编程时长热力）。
4. 待办、备忘：以内置扩展提供独立视图与逻辑。
5. 主题：浅色纸张感为主线，深色可选，可跟随系统。
6. 数据持久化：PWA 使用 OPFS；桌面壳写入用户数据目录下的真实文件夹。
7. 跨端：各端持有完整可合并副本；以桌面为汇合点交换更新；用户在桌面数据文件夹上自行备份或纳入自己的工作流。
8. 扩展：内置随应用发布；外部扩展可安装（PWA 装入 OPFS；桌面装入扩展目录并可附带 Native Agent）。外置安装与具体分发机制在后期阶段定稿。

---

## 2. 核心与扩展边界

### 2.1 核心（随主应用发布）

- 人生配置与日期 ↔ 日索引
- 日内容索引（`index.bin` 等）与按天日记（正文 + 媒体）
- Canvas 网格渲染与输入（布局、相机、总览/高清、命中检测）
- 存储抽象与各壳后端
- 应用壳：Onboarding、侧栏/底部导航骨架、日历视图、日记编辑器、设置（主题、寿命、存储占用、同步入口等）
- **Extension Host**：扫描/加载扩展、权限、Worker、贡献点注册、派发点与中间件链、Host API

### 2.2 内置扩展

| 扩展   | 职责                                                           |
| ------ | -------------------------------------------------------------- |
| `memo` | 与日期无关的碎片笔记；视图 tab + 文档读写                      |
| `todo` | 无日期 / 截止日 / 区间打卡；视图、编辑器相关贡献、格子覆盖标记 |

### 2.3 外部扩展（另仓，后期）

例如编程时长采集：桌面 Native Agent 提供 WakaTime 兼容的本机 HTTP 接收与聚合落盘；两端扩展包负责展示与配置。PWA 侧展示依赖已同步的汇总数据。包格式、安装流、Agent 加载细节后期定稿。

---

## 3. 双壳与共享前端

```
                    ┌─────────────────────────┐
                    │  共享前端 src/           │
                    │  domain · grid · ui ·    │
                    │  storage 接口 · host     │
                    └────────────┬────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                                     ▼
     ┌─────────────────┐                  ┌─────────────────┐
     │ PWA（浏览器）    │                  │ Tauri（桌面）     │
     │ 存储：OPFS       │                  │ 存储：本地目录    │
     │ Worker 跑扩展    │                  │ Worker 跑扩展    │
     │ wasm             │                  │ wasm             │
     │                  │                  │ + Native Agent   │
     │                  │                  │ （wasm，宿主内嵌  │
     │                  │                  │   运行时加载）    │
     │                  │                  │ + 同步汇合服务    │
     └─────────────────┘                  └─────────────────┘
```

- **一套 `src/`**：PWA 与 Tauri webview 共用。
- **PWA**：应用数据与（后期）已安装外部扩展均落在 OPFS。
- **Tauri**：应用数据写入用户选定/默认的数据文件夹；扩展可带仅桌面可用的 Native Agent（wasm 产物，由 Tauri 进程内嵌运行时加载，能力经宿主函数注入）。

---

## 4. 仓库布局

主仓库按空白产品仓组织：

```text
/
  ARCHITECTURE.md
  package.json                 # pnpm；Vite 构建前端 / PWA
  Cargo.toml                   # Rust workspace（阶段 3+）
  public/                      # 不经打包的静态资源（favicon 等）
  src/                         # 共享前端（PWA 与 Tauri webview 共用）
    domain/                    # 核心领域纯逻辑：人生配置、日索引、日记模型
    grid/                      # 人生网格：布局、相机、Canvas 渲染、命中检测
    storage/                   # 存储抽象与各壳实现（PWA: OPFS；桌面: 本地目录）
    extensions/                # Extension Host：manifest、权限、Worker、派发点/中间件链、Host API
    stores/                    # 前端状态：配置、主题、路由、存储状态等
    ui/                        # Svelte 界面：壳、Onboarding、日历、日记、设置
    app.css                    # 全局样式（含 Tailwind）
    main.ts                    # 应用启动入口
  src-tauri/                   # 桌面壳：FS、同步汇合、Agent 运行时挂载、外部扩展目录
  extensions/                  # 内置扩展包（随主应用发布）
    memo/
      manifest.json
      views/                   # Svelte 源码，由主应用构建管线打包
      src/                     # TS → logic.js（内置扩展逻辑默认用 TS）
    todo/
      …
  crates/                      # 宿主侧可共享的 Rust 库（Agent 宿主接口等；阶段 3+）
  tests/                       # 单元测试（domain / grid 等）
  e2e/                         # 端到端测试
```

外部扩展（独立 git 仓库）建议形态：

```text
<ext-repo>/
  manifest.json
  views/                       # 源码 → 预编译视图 JS
  logic/                       # 可选：TS → logic.js 或 Rust → logic.wasm
  agent/                       # 可选，仅桌面：Rust → agent.wasm
  dist/                        # 发布物：manifest + 预编译视图 JS（+ 可选 logic / agent 产物）
```

运行时加载的是 **`dist/` 预编译产物**（主应用无法在运行时编译外仓的 `.svelte` / TS 源码）。

---

## 5. 扩展系统

### 5.1 运行时

- **逻辑（可选）**：manifest `main` 声明，载体为 **JS 模块或 wasm**，均在 **Web Worker** 中加载，遵守同一 RPC 契约（如 Comlink）；主线程 Svelte 视图经 RPC 调用逻辑；能力经 Host API 注入。无逻辑层的纯视图扩展同样成立。内置扩展默认 TS → JS；需要 Rust 性能或与桌面侧复用代码时选 wasm。
- **桌面可选 Native Agent**：以 **wasm 产物**分发，由 Tauri 进程内嵌的 wasm 运行时加载并管理生命周期（例如常驻 HTTP 服务）；能力（HTTP 监听、定时器、受限 FS 等）由**宿主函数**注入，不挂载原生代码。Agent 聚合结果写入存储，再由展示侧读取。运行时选型与宿主函数 ABI 在阶段 4 定稿。
- **平台裁剪**：manifest 声明适用平台与贡献点；同一扩展在 PWA 与桌面可启用不同子集（例如仅桌面启用采集 Agent，两端都启用视图/格子覆盖）。

### 5.2 Manifest（首期子集，随后扩展）

```jsonc
{
  "id": "memo",
  "name": "备忘",
  "version": "1.0.0",
  "main": "logic.js", // 可选；亦可为 logic.wasm
  "permissions": ["doc:read", "doc:write"],
  "platforms": ["pwa", "desktop"],
  "contributes": {
    "views": [
      {
        "id": "memos",
        "label": "备忘",
        "icon": "note",
        "component": "views/MemoView.js",
      },
    ],
    // 后续：dayEditorTools、gridOverlays、settings、nativeAgents …
  },
}
```

内置扩展开发期可使用 `.svelte` 与 TS 源码并由主应用构建管线打包；字段在发布物中与外置 `dist` 对齐。

### 5.3 贡献点（按阶段启用）

| 贡献点           | 用途                          | 典型消费者            |
| ---------------- | ----------------------------- | --------------------- |
| `views`          | 导航 tab + 路由 + 懒加载视图  | memo、todo            |
| `gridOverlays`   | 总览改色 / 高清声明式绘制指令 | todo 截止点、时长热力 |
| `dayEditorTools` | 日记弹层工具区                | todo                  |
| `settings`       | 设置页分区                    | 需配置的扩展          |
| `nativeAgents`   | 桌面进程内 Agent              | 外部采集类扩展        |

贡献点的统一执行模型为**派发点 + 中间件链**：

- 核心把每个可扩展处定义为派发点；扩展经 manifest 声明挂接的派发点与处理入口，Host 据此把中间件挂成链。
- **核心默认实现位于链尾兜底**；中间件可前置/后置加工、改写链上数据，或**短路**。
- 短路默认实现即「覆盖核心功能」——独占替换是短路的特例，无需单独机制。
- 约束：性能关键路径不走链（如网格逐帧渲染，`gridOverlays` 维持声明式指令预取、宿主本地绘制）；多扩展短路同一派发点按优先级仲裁（用户选择 / 安装顺序，细则随 Host 实现定稿）；Host 提供各派发点注册情况查询，保证行为来源可观测。
- 首期派发点：`gridOverlays`、`dayEditorTools`（多扩展共存型）；`dayEditor` 渲染（可短路/覆盖型）。更多核心逻辑（如 doc 读写管道）随阶段开放。

### 5.4 Host API（首期与演进）

| 能力                   | 权限                     | 说明                                             |
| ---------------------- | ------------------------ | ------------------------------------------------ |
| `host.doc.read/write`  | `doc:read` / `doc:write` | 通用 JSON 文档（如 `memos.json`、`todos.json`）  |
| `host.log.*`           | —                        | 调试日志                                         |
| `host.grid.getDayMeta` | `grid:read`              | 格子上下文（后期）                               |
| `host.config.get/set`  | `config:*`               | 扩展私有配置命名空间（后期）                     |
| `host.net.fetch`       | `net:fetch`              | 带白名单的网络（若扩展需要；采集类优先走 Agent） |

格子覆盖采用**声明式指令**由宿主绘制（总览：颜色/强度混入像素；高清：dot/fill/text 等），扩展不直接持有 Canvas 上下文。

### 5.5 视图与权限

- 视图在主线程，可操作 DOM；读写数据与网络一律走 Host API。
- 内置扩展权限随应用授予。
- 外部扩展安装、签名与权限 UX 后期定稿。

---

## 6. 存储

### 6.1 接口

统一 `StorageBackend`：配置、日索引、按天文档与媒体、通用 `readDoc`/`writeDoc`、用量估计、zip 导出导入等。PWA 与 Tauri 提供不同实现，上层与扩展只依赖接口。

### 6.2 文件布局（逻辑树，两壳一致）

```text
config.json
index.bin
days/<n>.json
media/<n>/<id>.webp
media/<n>/<id>.thumb
todos.json          # 由 todo 扩展使用
memos.json          # 由 memo 扩展使用
# 其它扩展文档按约定命名
```

### 6.3 实现

| 壳    | 后端                                                           |
| ----- | -------------------------------------------------------------- |
| PWA   | OPFS（Worker 内 I/O；索引可用同步 access handle 做单字节补丁） |
| Tauri | 本地数据目录上的原生文件系统                                   |

媒体：Worker/原生侧缩放压缩为 WebP（长边上限约 2048），缩略图约 256。多标签写用 Web Locks 串行；变更可用 BroadcastChannel 通知同源其它页（PWA）。

### 6.4 备份与数据存储

桌面数据文件夹作为用户可直接操作的目录。PWA 通过与桌面同步对齐数据；用户在桌面侧复制、纳入版本管理或云盘目录等方式自行保管。应用亦提供 zip 导出/导入作为通用搬运手段。

---

## 7. 同步

- **拓扑**：桌面作为汇合点；PWA 与桌面交换更新；多台 PWA 经同一桌面间接一致。
- **数据模型**：每端完整副本，同步后可合并（类分布式版本库体验）。
- **具体合并实现**（如选用哪一种 CRDT 库、文档粒度、tombstone）在「Tauri + 同步」阶段定稿。
- **传输**：局域网发现（如 mDNS）+ 本地连接（如 WebSocket）；传的是合并后的文档/更新，而不是原始高频事件流（例如心跳）。
- **与扩展**：扩展的 `doc.*` 数据参与同一同步层；Agent 只在桌面写入本地，再进入同步。

---

## 8. 领域模型（核心）

### 8.1 LifeConfig

```ts
type LifeConfig = {
  birthdate: string // YYYY-MM-DD
  lifespanYears: number // 默认 80
  version: number
}
```

日期运算按 **UTC 零点**。`totalDays`、`dateOf`、`indexOf`、`todayIndex` 为纯函数；过去/今天/未来由 `todayIndex` 实时派生，不入库。

### 8.2 DayIndex

内存 `Uint8Array`，长度 = 总天数：`bit0` 有文字，`bit1` 有图片（持久化到 `index.bin`，文件带格式版本头）。扩展相关的格子提示（如进行中 todo）由扩展经覆盖层或运行时标志提供，不塞进核心持久化位定义之外的约定时需在贡献点契约中写明。

### 8.3 DayDoc

```ts
type DayDoc = {
  text: string
  media: { id: string; name: string; w: number; h: number; type: string }[]
  updatedAt: number
  version: number
}
```

正文首期纯文本；结构预留富文本演进。

---

## 9. 内置扩展领域（摘要）

### 9.1 Todo

```ts
type TodoSchedule =
  | { kind: 'none' }
  | { kind: 'deadline'; due: string }
  | { kind: 'range'; start: string; end: string; requiredDays: number }
```

分组：未达成 / 今日 / 近 7 日 / 之后 / 无日期 / 已完成。区间型按打卡天数达标；过期未完成标为未达成。截止日与区间结束日通过 `gridOverlays` 反映在日历上。

### 9.2 Memo

`{ id, text, updatedAt }`，按 `updatedAt` 倒序；就地编辑，经扩展逻辑与 `host.doc.*` 持久化。

---

## 10. 网格渲染

- **布局**：`cols ≈ round(sqrt(N × 视口宽高比))`，`rows = ceil(N / cols)`，正方形格贴合屏幕；`ResizeObserver` 回流并保持焦点天。
- **相机**：`scale` + 偏移；DPR 封顶约 2；缩放绕光标/双指中点。
- **总览**（格边长 < ~12px）：`Uint32Array` 直写像素 + 离屏缓存；平移缩放只贴图；单格脏则补画一格。
- **高清**（≥ ~12px）：只画视口内格；圆角、今天描边、扩展声明式覆盖。
- **输入**：Pointer Events；`touch-action: none`。
- **配色**：双主题 `GridColors`，与 CSS 变量同源。

可选：按约 365 日画年分隔（设置可关）。可修订。

---

## 11. UI 壳

- 桌面：左侧图标导航；移动：底部 tab。日历为默认主视图；扩展 `views` 并入导航与路由。
- 日记：原生 `<dialog showModal>`；history 返回关闭；深链 `?d=<index>`；防抖自动保存。
- 设置：寿命、主题、存储占用、同步与导出导入等。
- 错误边界：Svelte 5 `<svelte:boundary>` 包裹关键视图。

技术栈：Svelte 5 + Vite + TypeScript + Tailwind；PWA 用 vite-plugin-pwa 预缓存应用壳；桌面壳 Tauri 2。

---

## 12. 分期落地

### 阶段 1 — 核心 PWA

可安装/可离线的 PWA：Onboarding、网格、日记、OPFS 存储、主题、zip 导出导入。Extension Host 可先以最小接口就位或紧随本阶段末尾接入。

### 阶段 2 — Host + 内置扩展

完善 Extension Host（Worker、manifest、`views`、派发点与中间件链、`doc.*` / `log.*`）。落地 `memo`、`todo`（含 `gridOverlays` / 编辑器贡献等 todo 所需契约）。导航与路由由核心项 + 扩展贡献合并。

### 阶段 3 — Tauri + 同步

桌面壳、本地数据目录后端、同步汇合（多副本可合并；库与协议定稿）、桌面侧自管文件夹工作流打通。

### 阶段 4 — 外部扩展

PWA：外部扩展安装到 OPFS 并加载预编译包（无 Agent）。桌面：用户扩展目录 + Native Agent（wasm，内嵌运行时加载）。以独立仓库的采集/展示扩展验证端到端（WakaTime 兼容接收 → 聚合 → 同步 → 两端热力）。**安装 UX、签名、宿主函数 ABI 等细节本阶段开始前再定。**

---

## 13. 决策记录（摘要）

| 主题         | 选择                                                |
| ------------ | --------------------------------------------------- |
| 产品结构     | 核心日历+日记；memo/todo 内置扩展；重采集类另仓外置 |
| 前端         | 单一 `src/`，Svelte 5 + Vite + TS                   |
| 网格         | Canvas 2D + 离屏缓存 + 总览像素直写                 |
| 扩展逻辑     | Worker 内 JS 或 wasm（可选）；视图 Svelte           |
| 覆盖机制     | 派发点 + 中间件链；默认实现兜底，短路即覆盖         |
| 桌面特有能力 | Native Agent：wasm，Tauri 内嵌运行时 + 宿主函数     |
| PWA 存储     | OPFS                                                |
| 桌面存储     | 本地数据文件夹                                      |
| 同步         | 桌面汇合 + 多副本可合并；实现库后期定               |
| 仓库         | `src` + `src-tauri` + `extensions/*` + `crates/*`   |
| 外置扩展     | 另仓构建 `dist/`；PWA/桌面安装流后期定              |

本文随实现推进修订；标「后期定稿」的章节在进入对应阶段前再开决策。
