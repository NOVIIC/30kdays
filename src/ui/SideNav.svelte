<script lang="ts">
  let {
    view,
    onNavigate,
    items,
  }: {
    view: string
    onNavigate: (v: string) => void
    items: { id: string; label: string; icon: string }[]
  } = $props()
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
  {:else if icon === 'check'}
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-5 w-5">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  {:else if icon === 'note'}
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-5 w-5">
      <path
        d="M6 3.5h9L19 7.5V20a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V5a1.5 1.5 0 0 1 1-1.5Z"
        stroke-linejoin="round"
      />
      <path d="M9 11h6M9 15h4" stroke-linecap="round" />
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
        onclick={() => onNavigate(item.id)}
        aria-current={view === item.id ? 'page' : undefined}
        class="flex w-16 flex-col items-center gap-1 rounded-xl py-2.5 text-[11px] transition-colors
          {view === item.id
          ? 'bg-accent-soft text-accent'
          : 'text-soft hover:bg-sunken hover:text-ink'}"
      >
        {@render navIcon(item.icon)}
        {item.label}
      </button>
    {/each}
  </div>
</nav>

<!-- 移动端：底部标签栏 -->
<nav
  class="fixed inset-x-0 bottom-0 z-20 flex items-stretch border-t border-line bg-raised/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
>
  {#each items as item (item.id)}
    <button
      onclick={() => onNavigate(item.id)}
      aria-current={view === item.id ? 'page' : undefined}
      class="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] transition-colors
        {view === item.id ? 'text-accent' : 'text-soft'}"
    >
      {@render navIcon(item.icon)}
      {item.label}
    </button>
  {/each}
</nav>
