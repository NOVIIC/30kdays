<script lang="ts">
  /**
   * 应用壳：启动引导（loading）→ Onboarding / 导航骨架 + 视图切换。
   * 配置与日索引在 boot() 中从存储层载入（见 stores/storage、stores/day-index）。
   */
  import { onMount } from 'svelte'
  import { todayIndex } from '../core/domain'
  import { GRID_COLORS_DARK, GRID_COLORS_LIGHT } from '../core/grid'
  import { config } from '../stores/config'
  import { dayIndex } from '../stores/day-index'
  import { view } from '../stores/router'
  import { boot, bootState } from '../stores/storage'
  import { effectiveTheme, initTheme } from '../stores/theme'
  import CalendarView from './CalendarView.svelte'
  import Onboarding from './Onboarding.svelte'
  import SettingsView from './SettingsView.svelte'
  import SideNav from './SideNav.svelte'

  const gridColors = $derived($effectiveTheme === 'dark' ? GRID_COLORS_DARK : GRID_COLORS_LIGHT)
  const today = $derived($config ? todayIndex($config) : -1)

  onMount(() => {
    initTheme()
    void boot()
  })
</script>

<main class="h-full w-full overflow-hidden bg-bg text-ink">
  {#if $bootState === 'loading'}
    <div class="flex h-full items-center justify-center text-sm text-faint">载入中…</div>
  {:else if $bootState === 'onboarding'}
    <Onboarding />
  {:else if $config}
    <div class="flex h-full">
      <SideNav />
      <div class="relative min-w-0 flex-1">
        {#if $view === 'settings'}
          <SettingsView />
        {:else}
          <!-- 配置变化（如寿命调整）时重建日历 -->
          {#key $config}
            <CalendarView config={$config} dayIndex={$dayIndex} {today} colors={gridColors} />
          {/key}
        {/if}
      </div>
    </div>
  {/if}
</main>
