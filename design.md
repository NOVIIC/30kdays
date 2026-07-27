# 三万日 PWA — 设计文档

## 1. 概述

一个**纯静态、可安装的跨平台 PWA**，把用户的一生按「天」铺成一张可缩放的网格（约 3 万格）。四个功能模块：**人生日历**（网格主视图）、**按天日记**（点格子写文字+图片）、**待办**（全局清单，支持截止日与区间打卡）、**备忘录**（与日期无关的碎片笔记）。核心挑战是**流畅地动态显示约 3 万个格子**——通过 Canvas 2D + 离屏位图缓存解决。

### 目标

1. 把一生按天可视化成贴合屏幕的网格，初始即可见全部格子。
2. 滚轮 / 双指流畅缩放、拖拽平移，60fps。
3. 点格子打开当天日记编辑器，写文字 + 加图片，持久保存。
4. 待办：无日期 / 截止日 / 区间打卡（起止日 + 所需天数）三种调度，过期未完成记为「未达成」。
5. 备忘录：碎片笔记，就地编辑自动保存。
6. 过去 / 今天 / 未来 / 有内容 用颜色区分；todo 截止日在格上有标记点。
7. 双主题：浅色纸张感为主线 + 深色，跟随系统可手动覆盖。
8. 纯静态、可离线、可安装到 iOS / Android / 桌面。
9. 本地存储 + 备份导出/导入，防数据丢失。

### 非目标（YAGNI）

- **无后端、无账号、无实时跨设备同步**。同步手段是「导出/导入 zip」+「桌面端可选地把真实文件夹放进云盘目录」。
- v1 **不做 Markdown 富文本**（纯文本，数据结构预留）。
- **不用 Rust / WebGPU**：30k 规模下 Canvas 2D 已远超需求，GPU 无可感知收益、成本高。
- **不做原生壳打包**：纯 PWA。

---

## 2. 核心交互

1. **首次进入**：onboarding 选「生日」+「预期寿命」（滑块，默认 80 岁）。据此算出总天数，建立空数据。
2. **导航**：桌面左侧竖向图标导航（日历 / 待办 / 备忘 / 设置），移动端折叠为底部 tab；日历是默认主视图。
3. **总览（日历视图）**：全部格子铺满屏幕；未来=淡色、过去空白=中间色、写过日记的过去=墨色、今天=强调色大标记；进行中 todo 的截止日/区间结束日在格上有小标记点（放大可见）。
4. **缩放/平移**：滚轮或双指缩放（围绕光标/双指中点），拖拽平移；放大到一定程度切换成圆角格 + 今天描边环 + 截止点的高清模式；「全景」按钮一键复位。
5. **点格子**：打开当天日记编辑器浮层，显示日期/星期/年龄/「人生第 N 天」；写文字、加图片；自动保存。「今天」按钮直接打开今天的日记。
6. **待办视图**：按「未达成 / 今日 / 近 7 日 / 之后 / 无日期 / 已完成」分组；区间打卡型在今日组一键打卡；未达成项可编辑延长或删除；已完成组默认折叠。
7. **备忘视图**：卡片列表，点卡片就地编辑，失焦自动保存。
8. **备份与设置**：设置视图改预期寿命、切主题（浅色/深色/跟随系统）、导出全部数据为 zip / 从 zip 导入。

---

## 3. 架构总览

```
┌──────────────────────────────────────────────────────────────┐
│ UI 壳 (Svelte 5 + Vite + TS)                                   │
│   Onboarding · SideNav · CalendarView(GridView) · DayEditor ·  │
│   TodoView · TodoEditor · MemoView · SettingsView              │
├──────────────────────────────────────────────────────────────┤
│ 网格渲染器 (纯 TS, Canvas 2D)         ← 性能核心                │
│   layout(求 cols/rows) · camera · 离屏缓存 ·                   │
│   renderOverview / renderDetail · hitTest · input · palette    │
├──────────────────────────────────────────────────────────────┤
│ 领域层 (纯 TS, 可单测)                                          │
│   lifeConfig(日期↔index, 总天数, 今天) · dayIndex(状态位) ·    │
│   todo(调度/分组/打卡/过期) · memo                             │
├──────────────────────────────────────────────────────────────┤
│ 存储层 (TS, 跑在 Web Worker)                                    │
│   StorageBackend 接口 → OpfsBackend / FsAccessBackend          │
│   readDoc/writeDoc(todos/memos) · media(缩略图/压缩) · backup  │
├──────────────────────────────────────────────────────────────┤
│ PWA 层                                                          │
│   vite-plugin-pwa(离线应用壳) · storage.persist()              │
└──────────────────────────────────────────────────────────────┘
```

### 数据流

- **启动**：探测存储后端 → 读 `config.json`（无则进 onboarding）→ 把 `index.bin` 读入内存 `Uint8Array` → 渲染器据「索引 + 实时派生的时间状态」画总览。
- **点格子**：命中检测得 index → 路由打开编辑器 → 懒加载 `days/<n>.json` + 缩略图 → 编辑 → 防抖保存：写 `days/<n>.json`（及图片文件）→ 更新内存索引该字节 → 标记该格脏，补画进缓存位图。
- **平移/缩放**：只做相机变换 + 贴缓存位图，**不触碰数据**。
- **缩放/旋转屏幕**：重算 `cols/rows`（防抖）→ 重建缓存位图 → 相机保持对准原焦点天。

---

## 4. 领域模型

### 4.1 LifeConfig（`src/domain/lifeConfig.ts`，纯函数）

```ts
type LifeConfig = {
  birthdate: string // 'YYYY-MM-DD'
  lifespanYears: number // 默认 80
  version: number
}
```

- 所有日期运算在 **UTC 零点**进行，避免时区/夏令时误差；`birthdate` 以日期字符串存储。
- `totalDays(config)` = 从 `birthdate` 到 `birthdate + lifespanYears 年` 的日历天数（含闰日）。默认 80 岁 ≈ **29,220** 天。
- `dateOf(index)` = `birthdate + index 天`。
- `indexOf(date)` = `date` 与 `birthdate` 的整天差。
- `todayIndex()` = `indexOf(今天)`，夹到 `[0, totalDays-1]`；今天早于生日 → 视为未开始。
- **时间状态**由此实时派生，不入库：`index < todayIndex` 过去 / `=== ` 今天 / `> ` 未来。

### 4.2 DayIndex（`src/domain/dayIndex.ts`，纯函数 + 内存状态）

- 内存中一个 `Uint8Array`，长度 = 总天数，每天 1 字节**内容状态位标志**：
  - `bit0 = 有文字`，`bit1 = 有图片`（持久化到 `index.bin`）；`bit2 = 有关联的进行中 todo`（**运行时派生、不落盘**，由 `deadlineDayIndices` 算出后与日记标志位按位或传给渲染器）。
- 提供 `get/set(index, flags)`、`hasContent(index)`。
- 持久化为单个二进制文件 `index.bin`（≤ ~37KB），防抖 ~500ms。**单格改动用同步句柄 `write(byte, { at: index })` 单字节定位补丁**，写放大更低（移动端/电量友好），与 §6.2「单格只补画一格」一致；仅寿命缩放等批量变更才整写。
- **配色** = `f(时间状态, 内容状态)`（`palette.dayFill`）：未来 / 过去空白 / 过去有内容 / 今天（强调色填充）。双主题各一套 `GridColors`（`lightGridColors` / `darkGridColors`），主题切换时 `controller.setColors()` 整体换肤。

### 4.3 Todo（`src/domain/todo.ts`，纯函数）

```ts
type TodoSchedule =
  | { kind: 'none' } // 无日期（普通待办/愿望）
  | { kind: 'deadline'; due: string } // 截止日
  | { kind: 'range'; start: string; end: string; requiredDays: number } // 区间打卡
```

- 区间型：约束 `end - start + 1 ≥ requiredDays`；区间内**任意日期**可打卡（`checkins: string[]`），打卡数 ≥ 所需天数自动完成。
- **未达成**：截止日/结束日已过且未完成 → 状态 `failed`，界面上标「未达成」，可编辑延长日期或删除。
- `groupTodos(todos, today)` 按 `failed / today / upcoming(≤7天) / later / nodate / done` 分组排序，空组不显示。
- 日历标记点 = 进行中 todo 的 `deadline.due` 与 `range.end` 映射到人生日索引（`deadlineDayIndices`），见 §4.2 bit2。

### 4.4 Memo（`src/domain/memo.ts`）

- `{ id, text, updatedAt }`，与日期无关的碎片笔记，按 `updatedAt` 倒序展示。

---

## 5. 布局与相机

### 5.1 贴合屏幕的近似长方形

设总天数 `N`、视口宽高比 `A = 视口宽 / 视口高`：

```
cols = round( sqrt(N × A) )
rows = ceil( N / cols )            // 最后一行通常不满
cell = min(视口宽 / cols, 视口高 / rows)   // 正方形格子
```

- 网格比例 ≈ 屏幕比例 → 初始 fit-all 时四边只剩极小留白。
- index → 格位：`row = floor(index / cols)`，`col = index % cols`（左上→右下阅读序，早期在上、晚期在下）。
- 示例（N ≈ 29,220）：桌面 16:9 → 228×129（末行 36）；手机竖屏 9:19.5 → 116×252（末行 104）。

### 5.2 自适应回流

- 用 **`ResizeObserver`**（Baseline）观测 canvas 容器，捕获旋转 / 布局 / 容器尺寸变化 → 重算 `cols/rows`（防抖 ~150ms）→ 重建离屏缓存。比 `resize` 事件更稳、覆盖非窗口级尺寸变化。
- 回流后**相机保持对准回流前的焦点天**（默认今天或用户当前视图中心 index），减少跑位迷失。
- 取舍：放弃「一行=一岁」的年对齐。补偿手段见 5.4。

### 5.3 相机

- `Camera = { scale, offsetX, offsetY }`，提供屏幕↔世界坐标互转。
- 按 `devicePixelRatio` 设置 canvas 实际像素，保证高清屏清晰；**3 万格下 DPR 封顶 ~2**，3× 手机按全 DPR 渲染像素量 ×9、总览无可感知清晰度收益，封顶省显存与填充率。
- `scale` 夹在 `[fitAll, maxZoom]`：缩小不小于铺满全屏，放大上限约「格子 60–100px」。
- 缩放围绕光标 / 双指中点。

### 5.4 年标记（可选，默认开）

- 每 365 格画一条细分隔线，或隔年用极淡背景条带，标出时间结构，弥补放弃年对齐。设置里可关。

---

## 6. 渲染器（性能核心）

### 6.1 双模式（按格子像素尺寸切换，阈值 ~12px）

- **总览模式**（格子 < 12px）：每格仅纯色，**直接往一个 `Uint32Array`（RGBA packed）按 `row/col` 偏移写像素，再 `putImageData` 上屏**——比 3 万次 `fillRect` 更快、内存更低、随寿命增长扩展性更好；平移缩放只 `drawImage(缓存位图, 变换)`。**仅当数据 / 配置 / 布局变化才重建缓存**。贴图后叠加背景色细网格线（全景下每格仍可辨）与略大于单格的「今天」标记。
- **高清模式**（格子 ≥ 12px）：裁剪到视口，只画可见的数百~上千格——圆角格 + 间隙留白、今天强调色描边环、todo 截止日小圆点。

### 6.2 调度与失效

- `requestAnimationFrame` + dirty flag，**仅在脏时渲染**，不空转。
- dirty 触发源：相机变化、数据变化、resize、主题切换。
- **单格变化**：只把那一格补画进缓存位图（重画一个矩形），不全量重建。

### 6.3 命中检测

- O(1) 数学：屏幕坐标 → 世界坐标 → `row/col` → `index`；`index ≥ 总天数` 丢弃。

### 6.4 输入（统一 Pointer Events）

- 鼠标：滚轮缩放、拖拽平移、点击（无拖动）开格、hover 高亮。
- 触屏：双指缩放、单指平移、轻点开格。
- canvas 上 `touch-action: none` 防止页面误滚动/缩放。
- 惯性平移列为可选增强（可后置）。

---

## 7. 存储层（跑在 Web Worker）

I/O 全部在专用 Web Worker 进行，主线程经轻量 RPC（Comlink 或手写 postMessage）通信，保证大写入（如存图）时 UI/canvas 不掉帧。

### 7.1 StorageBackend 接口

```ts
interface StorageBackend {
  init(): Promise<void>
  readConfig(): Promise<LifeConfig | null>
  writeConfig(c: LifeConfig): Promise<void>
  readIndex(): Promise<Uint8Array | null>
  writeIndex(buf: Uint8Array): Promise<void>
  readDay(n: number): Promise<DayDoc | null>
  writeDay(n: number, doc: DayDoc): Promise<void>
  readMedia(n: number, id: string): Promise<Blob | null>
  writeMedia(n: number, id: string, blob: Blob): Promise<void>
  deleteMedia(n: number, id: string): Promise<void>
  readDoc<T>(name: string): Promise<T | null> // 通用 JSON 文档（todos/memos）
  writeDoc<T>(name: string, data: T): Promise<void>
  exportZip(): Promise<Blob>
  importZip(zip: Blob): Promise<void>
  estimate(): Promise<{ usage: number; quota: number }>
}
```

### 7.2 文件布局（两种后端一致，可热插拔）

```
config.json              生日、预期寿命、版本
index.bin                Uint8Array[总天数]，每天 1 字节位标志（日记内容）
days/<n>.json            { text, media:[{id,name,w,h,type}], updatedAt }
media/<n>/<id>.<ext>     原图（存前用 Worker 内 `OffscreenCanvas.convertToBlob({type:'image/webp', quality})` 压成 WebP，长边上限 ~2048px；quality 可调；AVIF 在 Safari 编码受限不采用）
media/<n>/<id>.thumb     缩略图（长边 ~256px，Worker 内 OffscreenCanvas 生成）
todos.json               Todo[]（标题 + 调度 + checkins + done）
memos.json               Memo[]（碎片笔记）
```

```ts
type DayDoc = {
  text: string
  media: { id: string; name: string; w: number; h: number; type: string }[]
  updatedAt: number
}
```

### 7.3 两种后端

- **FsAccessBackend（桌面 Chromium 默认）**：`showDirectoryPicker()` 选一次真实文件夹；`FileSystemDirectoryHandle` 存进 IndexedDB，下次启动 `requestPermission` 重新授权。数据落在用户可见文件夹，放进 iCloud/Dropbox/Git 目录可白嫖跨设备同步备份，用户拥有数据主权。
- **OpfsBackend（兜底，覆盖移动端 / Safari / Firefox）**：`navigator.storage.getDirectory()`。索引用 Worker 同步句柄 `createSyncAccessHandle`（`close/flush/getSize/truncate` 现为同步方法），正文/图片用异步写入流。iOS Safari 16.4+、全平台 2023.3 起 Baseline widely available。
- **兼容性事实**：`showDirectoryPicker()` 至今仅桌面 Chromium 实现；移动端 Chromium、iOS/桌面 Safari、Firefox 均不可用，故 OPFS 为不可省的兜底。

### 7.4 后端选择与迁移

- **默认逻辑反转**：探测到 FS Access 可用（桌面 Chromium）→ onboarding 即引导选真实文件夹并设为默认，用户拿到数据主权与同步便利；不可用 → 自动走 OPFS 兜底。
- 设置里提供「切换存储后端（桌面）」：切换时**一次性拷贝迁移**现有数据，绝不静默拆分两份数据。
- iOS/Android/Safari/Firefox 无 FS Access → 自动只走 OPFS。

### 7.5 备份与持久化

- **导出/导入**：用 `fflate`（极小、快）把整棵树打成 zip 下载 / 解压写回。这是全平台通用的备份与跨设备搬运手段。
- 首次保存时 `navigator.storage.persist()` 申请持久化，防浏览器回收 OPFS 数据；设置里用 `storage.estimate()` 显示占用。

### 7.6 多标签页协调

- OPFS 与真实文件夹均跨同源标签页共享，用户开多标签同时编辑会互相覆盖 `index.bin` / `days/<n>.json`。
- 写操作用 **Web Locks**（Baseline）串行化，避免并发写冲突。
- `index.bin` / `config.json` 变更经 **BroadcastChannel**（Baseline）推给其它同源标签，各自刷新内存索引与缓存。
- 真实文件夹后端另可叠加 `FileSystemObserver`（见 §15）观察外部（云盘客户端）改动。

---

## 8. 日记编辑器（`DayEditor.svelte`）

- 以**原生 `<dialog>` + `showModal()`**（Baseline）打开：移动端全屏 sheet、桌面居中弹窗/侧栏；免费提供焦点陷阱、ESC 关闭、backdrop、`aria-modal` 与 inert 管理，与下面 history state 返回关闭叠加无冲突。
- 压入 history state → 系统「返回」即关闭；可深链 `?d=<index>`，便于回到具体某天。
- 头部：日期、星期、年龄、「人生第 N 天」。
- 正文：纯文本 textarea（数据结构预留 Markdown）。
- 图片：选择 / 拖拽 / 粘贴添加；缩略图网格，点开看大图 / 删除。
- 保存：自动保存防抖，关闭时 flush；保存后更新内存索引该字节并使该格失效重画。
- 导航：上一天 / 下一天箭头。

---

## 9. Onboarding 与设置

- **首次**：生日选择器 + 预期寿命滑块（默认 80）。算出总天数 → 写 `config.json` + 空 `index.bin`。
- **设置**（独立视图，非弹层）：
  - 改预期寿命：调整索引长度并保数据；变长补零，变短若会丢弃已填日期则**警告确认**。
  - 主题：浅色 / 深色 / 跟随系统（`stores/theme.ts`，localStorage 持久化，`<html>` 切 `.dark` 类；index.html 内联脚本首屏前应用，避免闪烁）。
  - 导出 / 导入 zip。
  - 存储占用显示。

---

## 10. PWA / 跨平台适配

- `vite-plugin-pwa`（Workbox）预缓存**应用壳与静态资源** → 离线可用。**用户数据在 OPFS/真实文件夹，不进 SW 缓存**；SW 只缓存代码。
- `manifest`：名称、maskable 图标、`display: standalone`、主题/背景色。**图标 / iOS 启动屏 / Apple touch 用 `@vite-pwa/assets-generator`（vite-plugin-pwa v1.2.0 配套）从单张源图生成**，含深色启动屏，减少手工资产。
- 响应式：canvas 占满视口；控件触摸友好（命中区 ≥ 44px）；刘海安全区 `env(safe-area-inset-*)`；高 DPI 经 `devicePixelRatio`。
- iOS：OPFS 路径可用、可「添加到主屏」；无 FS Access 自动回退——与后端选择逻辑一致。

---

## 11. 模块结构

```
src/domain/   lifeConfig.ts · dayIndex.ts · todo.ts · memo.ts     ← 纯函数，重点单测
src/storage/  StorageBackend.ts · opfsBackend.ts · fsAccessBackend.ts ·
              worker.ts(RPC) · backup.ts(zip) · media.ts(缩略图/压缩)
src/grid/     gridCanvas.ts(控制器) · layout.ts(cols/rows+回流) · camera.ts ·
              renderOverview.ts · renderDetail.ts · hitTest.ts · input.ts ·
              palette.ts(GridColors 双主题配色)
src/ui/       App.svelte(壳+路由) · SideNav.svelte(导航) · CalendarView.svelte ·
              GridView.svelte(挂载 gridCanvas) · DayEditor.svelte ·
              TodoView.svelte · TodoEditor.svelte · MemoView.svelte ·
              SettingsView.svelte · Onboarding.svelte
src/stores/   config · todos · memos · theme · router · storageStatus
src/app.css   设计系统：双主题 CSS 变量 + Tailwind 语义色（bg/ink/line/accent…）
tests/        domain / storage / grid 数学 的单元与集成测试
```

**边界原则**：`domain` 与 `grid` 为框架无关的纯 TS，可独立单测；Svelte 只管壳子、路由、编辑器、设置；存储后端经接口隔离、可热插拔。

---

## 12. 测试策略

- **单元（Vitest）**：日期↔index（含闰年）、todayIndex、寿命缩放、`layout` 的 cols/rows 求解、配色映射、命中检测数学、zip 往返。
- **集成**：OPFS 后端读写往返、后端切换迁移、编辑器存取流程（mock 后端）。
- **性能冒烟**：断言 N 格总览渲染 < 帧预算；DevTools 手测平移/缩放 60fps。
- **跨浏览器手测**：Chrome（FS Access 路径）、iOS Safari（OPFS 路径）、Firefox。

---

## 13. 错误处理

- **壳层用 Svelte 5 `<svelte:boundary>`** 承接 GridView / DayEditor / Settings 渲染异常，展示 fallback + 恢复按钮，比手写 try/catch 包裹更 idiomatic；覆盖「回流重建缓存出错保留上一份可用缓存」等场景。
- FS Access 权限被拒 / 重启后丢失 → 提示重新授权；拒绝则回退 OPFS。
- 配额超限（大图）→ 捕获、提示、建议导出清理、显示占用。
- 索引 / 正文文件损坏 → 读时校验；**索引丢失但 `days/` 还在 → 扫描 `days/` 重建索引（自愈）**。
- 图片过大 / 不支持类型 → 存前降采样压缩；不支持类型优雅拒绝。
- 多标签写冲突 → Web Lock 串行化 + BroadcastChannel 刷新（见 §7.6）。

---

## 14. 技术选型理由（决策记录）

| 决策         | 选择                                                   | 理由                                                                                               |
| ------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| 渲染         | Canvas 2D + 离屏位图缓存                               | 30k 次 fillRect 远在 16ms 内；缓存后平移缩放≈贴图免费。WebGL/WebGPU 在此规模无可感知收益且成本高。 |
| 框架         | Svelte 5 + Vite + TS                                   | 运行时/包最小，利于 PWA 离线与加载；网格是框架无关的纯 TS 控制器，框架只管壳子。                   |
| 存储         | StorageBackend 抽象：桌面 FS Access + 全平台 OPFS 回退 | FS Access 在 iOS/Safari/Firefox/移动端不可用，必须有 OPFS 兜底；接口隔离使其可热插拔。             |
| 布局         | 贴合屏幕长方形 + 自适应回流                            | 满足「初始见全部、四边无空隙」；牺牲年对齐，用可选年标记补偿。                                     |
| 备份         | fflate 打 zip 导出/导入                                | 纯本地存储需防丢；全平台通用，无需后端。                                                           |
| 存储默认     | 桌面 Chromium 默认真实文件夹，OPFS 兜底                | 用户要数据主权 + 同步便利；FS Access 仅桌面 Chromium，OPFS 不可省。                                |
| 浮层         | 原生 `<dialog>` + `showModal()`                        | 焦点陷阱 / ESC / backdrop / aria-modal 免费，Svelte 5 配合良好。                                   |
| 错误处理     | Svelte 5 `<svelte:boundary>`                           | 壳层渲染异常 fallback + 恢复，覆盖缓存重建失败等场景。                                             |
| 多标签       | Web Locks + BroadcastChannel                           | 防同源多标签并发写覆盖，index/config 变更互推。                                                    |
| 渲染像素直写 | 总览模式 `Uint32Array` + `putImageData`                | 3 万纯色格直写像素比 3 万次 `fillRect` 更快、内存更低。                                            |
| 容器尺寸监听 | `ResizeObserver`                                       | 覆盖旋转 / 布局 / 容器变化，比 `resize` 事件更稳。                                                 |
| 主题         | CSS 变量双主题（浅色纸张感为主线）                     | `<html>.dark` 一处切换全量换肤；canvas 配色经 `GridColors` 与 CSS 变量同源。                       |
| 导航         | 左侧竖向图标导航 + 视图切换（移动端底部 tab）          | 日历保持全屏沉浸；待办/备忘/设置各有独立视图，结构简单。                                           |
| Todo 调度    | 无日期 / 截止日 / 区间+所需天数                        | 覆盖「X 前完成」与「N 天里完成 k 次」两类真实目标；打卡达标自动完成，过期记未达成。                |

---

## 15. 未来 / 升级路径

- **`FileSystemObserver` 适配云盘同步**（feature-detect 渐进增强）：该 API 可观察用户可见文件夹与 OPFS 的外部变更、免轮询，正好服务 FsAccessBackend 放进 iCloud/Dropbox 时云盘客户端从外部改文件夹的同步场景。当前 **Experimental / Non-standard / 仅 Chrome**（2025-07 MDN 仍如此），降级为轮询。
- **View Transitions API**：cell → editor 的丝滑过场，Chrome 已 Baseline、其它浏览器追赶中，渐进增强。
- 想上百万格或加 GPU 过场特效 → 渲染器升级到 WebGL（PixiJS）或 TS 调 WebGPU（保 Canvas 回退）；当前模块结构可平滑迁移。
- 富文本 → 把正文从纯文本换成 Markdown 渲染（`DayDoc.text` 结构已兼容）。
- 真正的跨设备实时同步 → 引入后端 / CRDT（当前 StorageBackend 接口可再加一个 RemoteBackend 实现）。
