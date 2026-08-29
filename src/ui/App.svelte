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
  import { extensionViews } from '../stores/host'
  import { view } from '../stores/router'
  import { boot, bootError, bootState } from '../stores/storage'
  import { effectiveTheme, initTheme } from '../stores/theme'
  import CalendarView from './CalendarView.svelte'
  import DayEditor from './DayEditor.svelte'
  import ExtensionView from './ExtensionView.svelte'
  import Onboarding from './Onboarding.svelte'
  import SettingsView from './SettingsView.svelte'
  import SideNav from './SideNav.svelte'
  import ViewError from './ViewError.svelte'

  const gridColors = $derived($effectiveTheme === 'dark' ? GRID_COLORS_DARK : GRID_COLORS_LIGHT)
  const today = $derived($config ? todayIndex($config) : -1)
  /** 当前路由命中的扩展视图（未命中为 undefined，落到日历）。 */
  const extView = $derived(extensionViews.find((v) => v.id === $view))

  onMount(() => {
    initTheme()
    void boot()
  })
</script>

<main class="h-full w-full overflow-hidden bg-bg text-ink">
  {#if $bootState === 'loading'}
    <div class="flex h-full items-center justify-center text-sm text-faint">载入中…</div>
  {:else if $bootState === 'error'}
    <div class="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <p class="text-sm">无法访问本地存储，应用无法启动。</p>
      <p class="max-w-md text-xs text-faint">
        请确认浏览器支持 OPFS（建议使用最新版 Chrome / Edge / Safari），且未处于无痕模式。
      </p>
      {#if $bootError}
        <p class="max-w-md text-xs break-all text-faint">{$bootError}</p>
      {/if}
      <button
        class="rounded-xl bg-accent px-6 py-2.5 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-strong"
        onclick={() => void boot()}
      >
        重试
      </button>
    </div>
  {:else if $bootState === 'onboarding'}
    <!-- 各视图独立错误边界：一处崩溃不影响其余，重试仅重建失败视图 -->
    <svelte:boundary>
      <Onboarding />
      {#snippet failed(_error, reset)}
        <ViewError message="初始化界面加载失败。" onreset={reset} />
      {/snippet}
    </svelte:boundary>
  {:else if $config}
    <div class="flex h-full">
      <SideNav />
      <div class="relative min-w-0 flex-1">
        {#if $view === 'settings'}
          <svelte:boundary>
            <SettingsView />
            {#snippet failed(_error, reset)}
              <ViewError message="设置页加载失败。" onreset={reset} />
            {/snippet}
          </svelte:boundary>
        {:else if extView !== undefined}
          <!-- 扩展视图：按 id 重建，错误边界兜底 -->
          {#key extView.id}
            <svelte:boundary>
              <ExtensionView view={extView} />
              {#snippet failed(_error, reset)}
                <ViewError message="扩展视图「{extView.label}」加载失败。" onreset={reset} />
              {/snippet}
            </svelte:boundary>
          {/key}
        {:else}
          <!-- 配置变化（如寿命调整）时重建日历 -->
          {#key $config}
            <svelte:boundary>
              <CalendarView config={$config} dayIndex={$dayIndex} {today} colors={gridColors} />
              {#snippet failed(_error, reset)}
                <ViewError message="日历加载失败。" onreset={reset} />
              {/snippet}
            </svelte:boundary>
          {/key}
        {/if}
      </div>
    </div>
    <!-- 日记编辑器：深链 ?d=<index> 驱动，与当前视图无关；reset 后依深链重新打开 -->
    <svelte:boundary>
      <DayEditor />
      {#snippet failed(_error, reset)}
        <ViewError message="日记编辑器出错了。" onreset={reset} />
      {/snippet}
    </svelte:boundary>
  {/if}
</main>
