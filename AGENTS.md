Interview me relentlessly about every aspect of the action you are about to do until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time, waiting for feedback on each question before continuing. Asking multiple questions at once is bewildering.

If a fact can be found by exploring the codebase, look it up rather than asking me. The decisions, though, are mine — put each one to me and wait for my answer.

Do not act until I confirm we have reached a shared understanding.

Communicate with me in Chinese.

---

# 项目背景

人生日历 PWA（30kdays）：把一生约 3 万天铺成可缩放网格。四个功能模块：**人生日历**（canvas 主视图）、**按天日记**（文字+图片）、**待办**（无日期/截止日/区间打卡三种调度，过期记未达成）、**备忘录**（与日期无关的碎片笔记）。

## 技术栈

Svelte 5（runes）+ Vite + TypeScript + Tailwind CSS 4 + vite-plugin-pwa。包管理用 pnpm。

## 常用命令

- `pnpm dev` 开发 · `pnpm build` 构建
- `pnpm check` 类型检查（svelte-check + tsc）· `pnpm lint`（eslint）· `pnpm test`（vitest）
- `pnpm format` / `pnpm format:check`（prettier）

## 结构与约定

- `src/domain/`：纯函数领域层（lifeConfig / dayIndex / todo / memo），改动须配测试（`tests/` 镜像目录）。
- `src/grid/`：框架无关的 canvas 渲染器；配色集中在 `palette.ts` 的 `GridColors`（light/dark 各一套）。
- `src/storage/`：`StorageBackend` 接口 + OpfsBackend / FsAccessBackend 两实现；todos、memos 等全局 JSON 文档走 `readDoc/writeDoc`。
- `src/ui/`：App 壳（hash 路由：calendar / todo / memos / settings）+ SideNav（桌面左侧导航 / 移动端底部 tab）+ 四视图 + DayEditor / TodoEditor 弹层 + Onboarding。
- 主题：`app.css` 定义双主题 CSS 变量（`:root` / `.dark`），组件只用 Tailwind 语义类（`bg-bg`、`text-ink`、`text-soft`、`border-line`、`bg-accent`…），**不写死颜色**；canvas 侧用 `GridColors` 并经 `controller.setColors()` 换肤。
- 详细设计决策见 `design.md`。