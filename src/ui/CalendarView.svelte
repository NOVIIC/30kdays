<script lang="ts">
  import GridView from './GridView.svelte'
  import type { GridColors } from '../grid/palette'

  let {
    totalDays,
    todayIndex,
    getDayFlags,
    onCellClick,
    onToday,
    colors,
  }: {
    totalDays: number
    todayIndex: number
    getDayFlags: (index: number) => number
    onCellClick: (index: number) => void
    onToday: () => void
    colors: GridColors
  } = $props()

  let grid: GridView

  const lived = $derived(todayIndex + 1)
  const percent = $derived(((lived / totalDays) * 100).toFixed(1))

  export function refresh() {
    grid?.refresh()
  }
</script>

<div class="relative h-full w-full overflow-hidden">
  <GridView bind:this={grid} {totalDays} {todayIndex} {getDayFlags} {onCellClick} {colors} />

  <!-- 顶部操作 -->
  <div class="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
    <div></div>
    <div class="pointer-events-auto flex gap-2">
      <button
        onclick={() => grid?.resetView()}
        class="rounded-full border border-line bg-raised/85 px-3.5 py-1.5 text-xs text-soft shadow-sm backdrop-blur-md transition-colors hover:text-ink"
      >
        全景
      </button>
      <button
        onclick={onToday}
        class="rounded-full border border-line bg-raised/85 px-3.5 py-1.5 text-xs text-accent shadow-sm backdrop-blur-md transition-colors hover:bg-accent-soft"
      >
        今天
      </button>
    </div>
  </div>

  <!-- 底部统计 -->
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
        <span class="inline-block h-2 w-2 rounded-full bg-accent"></span>今天 / 截止
      </span>
      <span class="flex items-center gap-1.5">
        <span class="inline-block h-2 w-2 rounded-sm" style="background: {colors.pastContent}"
        ></span>有记录
      </span>
      <span>滚轮缩放 · 点击写日记</span>
    </div>
  </div>
</div>
