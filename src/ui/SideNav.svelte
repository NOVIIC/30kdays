<script lang="ts">
  /**
   * 导航骨架：桌面左侧竖向导航，移动端底部标签栏。
   * 导航项由核心项 + 扩展 views 贡献合并（见 stores/host）。
   */
  import { extensionViews } from '../stores/host'
  import { navigate, view } from '../stores/router'

  /**
   * 导航项：核心项在前，扩展贡献按注册顺序在后。
   * 设置项单独维护：桌面端沉在侧栏底部，移动端拼在标签栏末尾。
   */
  const items = [
    { id: 'calendar', label: '日历', icon: 'grid' },
    ...extensionViews.map((v) => ({ id: v.id, label: v.label, icon: v.icon })),
  ]
  const settingsItem = { id: 'settings', label: '设置', icon: 'gear' }
</script>

{#snippet navIcon(icon: string)}
  {#if icon === 'grid'}
    <svg viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5">
      <circle cx="5" cy="5" r="1.6" /><circle cx="12" cy="5" r="1.6" /><circle
        cx="19"
        cy="5"
        r="1.6"
      />
      <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle
        cx="19"
        cy="12"
        r="1.6"
      />
      <circle cx="5" cy="19" r="1.6" /><circle cx="12" cy="19" r="1.6" /><circle
        cx="19"
        cy="19"
        r="1.6"
      />
    </svg>
  {:else if icon === 'note'}
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-5 w-5">
      <path
        d="M5 4.5h14v15H5z M8.5 9h7 M8.5 12.5h7 M8.5 16h4.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  {:else if icon === 'check'}
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-5 w-5">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  {:else}
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-5 w-5">
      <circle cx="12" cy="12" r="3" />
      <path
        d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5"
        stroke-linecap="round"
      />
    </svg>
  {/if}
{/snippet}

<!-- 桌面：左侧竖向导航 -->
<nav class="hidden w-20 shrink-0 flex-col items-center border-r border-line bg-raised py-6 md:flex">
  <div
    class="mb-8 flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-contrast"
  >
    <svg viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5">
      <circle cx="5" cy="5" r="1.6" /><circle cx="12" cy="5" r="1.6" /><circle
        cx="19"
        cy="5"
        r="1.6"
      />
      <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle
        cx="19"
        cy="12"
        r="1.6"
      />
      <circle cx="5" cy="19" r="1.6" /><circle cx="12" cy="19" r="1.6" /><circle
        cx="19"
        cy="19"
        r="1.6"
      />
    </svg>
  </div>
  <div class="flex flex-col gap-1.5">
    {#each items as item (item.id)}
      <button
        onclick={() => navigate(item.id)}
        aria-current={$view === item.id ? 'page' : undefined}
        class="flex w-16 flex-col items-center gap-1 rounded-xl py-2.5 text-[11px] transition-colors
          {$view === item.id
          ? 'bg-accent-soft text-accent'
          : 'text-soft hover:bg-sunken hover:text-ink'}"
      >
        {@render navIcon(item.icon)}
        {item.label}
      </button>
    {/each}
  </div>
  <button
    onclick={() => navigate(settingsItem.id)}
    aria-current={$view === settingsItem.id ? 'page' : undefined}
    class="mt-auto flex w-16 flex-col items-center gap-1 rounded-xl py-2.5 text-[11px] transition-colors
      {$view === settingsItem.id
      ? 'bg-accent-soft text-accent'
      : 'text-soft hover:bg-sunken hover:text-ink'}"
  >
    {@render navIcon(settingsItem.icon)}
    {settingsItem.label}
  </button>
</nav>

<!-- 移动端：底部标签栏 -->
<nav
  class="fixed inset-x-0 bottom-0 z-20 flex items-stretch border-t border-line bg-raised/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
>
  {#each [...items, settingsItem] as item (item.id)}
    <button
      onclick={() => navigate(item.id)}
      aria-current={$view === item.id ? 'page' : undefined}
      class="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] transition-colors
        {$view === item.id ? 'text-accent' : 'text-soft'}"
    >
      {@render navIcon(item.icon)}
      {item.label}
    </button>
  {/each}
</nav>
