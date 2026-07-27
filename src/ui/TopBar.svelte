<script lang="ts">
  let {
    onSettings,
    onToday,
  }: {
    onSettings: () => void
    onToday: () => void
  } = $props()
</script>

<header
  class="pointer-events-none absolute left-0 right-0 top-0 z-10 flex items-center justify-between p-4"
>
  <div class="text-sm font-medium text-white/60">30kdays</div>
  <div class="pointer-events-auto flex gap-2">
    <button
      onclick={onToday}
      class="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20"
    >
      今天
    </button>
    <button
      onclick={onSettings}
      class="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20"
    >
      设置
    </button>
  </div>
</header>
