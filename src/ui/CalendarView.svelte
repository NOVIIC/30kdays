<script lang="ts">
  /**
   * 日历视图：网格主视图 + 悬浮操作（全景 / 今天）+ 底部统计与图例。
   */
  import { totalDays, type LifeConfig } from '../core/domain'
  import type { DayOverlay, GridColors } from '../core/grid'
  import { navigateToDay } from '../stores/router'
  import GridView from './GridView.svelte'

  let {
    config,
    dayIndex,
    today,
    colors,
    overlays,
  }: {
    config: LifeConfig
    dayIndex: Uint8Array
    today: number
    colors: GridColors
    overlays: ReadonlyMap<number, DayOverlay>
  } = $props()

  let grid: GridView

  // 配置变化时组件经 #key 重建，此处只在挂载时计算一次
  const total = $derived(totalDays(config))
  const lived = $derived(Math.max(0, today + 1))
  const percent = $derived(((lived / total) * 100).toFixed(1))
</script>

<div class="relative h-full w-full overflow-hidden">
  <GridView
    bind:this={grid}
    {config}
    {dayIndex}
    {today}
    {colors}
    {overlays}
    ondayclick={navigateToDay}
  />

  <!-- 顶部操作 -->
  <div class="pointer-events-none absolute inset-x-0 top-0 flex justify-end p-4">
    <div class="pointer-events-auto flex gap-2">
      <button
        onclick={() => grid.resetView()}
        class="rounded-full border border-line bg-raised/85 px-3.5 py-1.5 text-xs text-soft shadow-sm backdrop-blur-md transition-colors hover:text-ink"
      >
        全景
      </button>
      <button
        onclick={() => grid.goToDay(today)}
        class="rounded-full border border-line bg-raised/85 px-3.5 py-1.5 text-xs text-accent shadow-sm backdrop-blur-md transition-colors hover:bg-accent-soft"
      >
        今天
      </button>
    </div>
  </div>

  <!-- 底部统计与图例 -->
  <div
    class="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-4 pb-20 md:pb-4"
  >
    <div
      class="rounded-full border border-line bg-raised/85 px-3.5 py-1.5 text-xs text-soft shadow-sm backdrop-blur-md"
    >
      已度过 <span class="tnum font-medium text-ink">{lived.toLocaleString()}</span> 天 ·
      <span class="tnum">{percent}%</span>
    </div>
    <div
      class="hidden items-center gap-3 rounded-full border border-line bg-raised/85 px-3.5 py-1.5 text-[11px] text-faint shadow-sm backdrop-blur-md sm:flex"
    >
      <span class="flex items-center gap-1.5">
        <span class="inline-block h-2 w-2 rounded-full" style="background: {colors.today}"></span>
        今天
      </span>
      <span class="flex items-center gap-1.5">
        <span class="inline-block h-2 w-2 rounded-sm" style="background: {colors.text}"></span>
        有记录
      </span>
      <span>滚轮缩放 · 拖拽平移</span>
    </div>
  </div>
</div>
