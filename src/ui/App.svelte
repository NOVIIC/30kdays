<script lang="ts">
  /**
   * 应用壳：Onboarding → 导航骨架 + 视图切换。
   * 数据暂为内存态：配置在 stores/config，日索引为全空，刷新后回到 Onboarding。
   */
  import { onMount } from 'svelte'
  import { createDayIndex, todayIndex, totalDays } from '../core/domain'
  import { GRID_COLORS_DARK, GRID_COLORS_LIGHT } from '../core/grid'
  import { config } from '../stores/config'
  import { view } from '../stores/router'
  import { effectiveTheme, initTheme } from '../stores/theme'
  import CalendarView from './CalendarView.svelte'
  import Onboarding from './Onboarding.svelte'
  import SettingsView from './SettingsView.svelte'
  import SideNav from './SideNav.svelte'

  const gridColors = $derived($effectiveTheme === 'dark' ? GRID_COLORS_DARK : GRID_COLORS_LIGHT)
  const dayIndex = $derived($config ? createDayIndex(totalDays($config)) : new Uint8Array(0))
  const today = $derived($config ? todayIndex($config) : -1)

  onMount(initTheme)
</script>

<main class="h-full w-full overflow-hidden bg-bg text-ink">
  {#if $config === null}
    <Onboarding />
  {:else}
    <div class="flex h-full">
      <SideNav />
      <div class="relative min-w-0 flex-1">
        {#if $view === 'settings'}
          <SettingsView />
        {:else}
          <!-- 配置变化（如寿命调整）时重建日历 -->
          {#key $config}
            <CalendarView config={$config} {dayIndex} {today} colors={gridColors} />
          {/key}
        {/if}
      </div>
    </div>
  {/if}
</main>
