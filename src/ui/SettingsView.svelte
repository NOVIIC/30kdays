<script lang="ts">
  import { onMount } from 'svelte'
  import { themeSetting, setTheme, type ThemeSetting } from '../stores/theme'

  let {
    config,
    onConfigChange,
    onExport,
    onImport,
  }: {
    config: { lifespanYears: number } | null
    onConfigChange: (lifespan: number) => Promise<void>
    onExport: () => Promise<void>
    onImport: (file: File) => Promise<void>
  } = $props()

  let lifespan = $state(config?.lifespanYears ?? 80)
  let usage = $state('')
  let exporting = $state(false)
  let importing = $state(false)
  let fileInputEl = $state<HTMLInputElement | null>(null)

  const themeOptions: { id: ThemeSetting; label: string }[] = [
    { id: 'light', label: '浅色' },
    { id: 'dark', label: '深色' },
    { id: 'system', label: '跟随系统' },
  ]

  onMount(async () => {
    if ('storage' in navigator) {
      const est = await navigator.storage.estimate()
      const used = est.usage ?? 0
      const quota = est.quota ?? 0
      usage = `${(used / 1024 / 1024).toFixed(1)} MB / ${(quota / 1024 / 1024).toFixed(1)} MB`
    }
  })

  async function handleExport() {
    exporting = true
    try {
      await onExport()
    } finally {
      exporting = false
    }
  }

  async function handleImport(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    importing = true
    try {
      await onImport(file)
    } finally {
      importing = false
    }
    input.value = ''
  }
</script>

<div class="h-full overflow-y-auto">
  <div class="mx-auto max-w-2xl px-5 pb-28 pt-8 md:pb-12">
    <h1 class="mb-6 text-xl font-medium tracking-tight">设置</h1>

    <section class="mb-7">
      <h2 class="mb-2.5 text-xs font-medium tracking-wide text-faint">人生</h2>
      <div class="rounded-2xl border border-line bg-raised p-4">
        <div class="flex items-baseline justify-between">
          <span class="text-sm text-ink">预期寿命</span>
          <span class="text-sm text-soft">
            <span class="tnum font-medium text-ink">{lifespan}</span> 岁 · 约
            <span class="tnum">{Math.round(lifespan * 365.25).toLocaleString()}</span> 天
          </span>
        </div>
        <input
          type="range"
          min="50"
          max="120"
          bind:value={lifespan}
          onchange={async () => {
            if (lifespan !== config?.lifespanYears) await onConfigChange(lifespan)
          }}
          class="mt-3 w-full accent-[var(--accent)]"
        />
      </div>
    </section>

    <section class="mb-7">
      <h2 class="mb-2.5 text-xs font-medium tracking-wide text-faint">外观</h2>
      <div class="rounded-2xl border border-line bg-raised p-4">
        <div class="flex rounded-xl border border-line bg-sunken p-1">
          {#each themeOptions as opt (opt.id)}
            <button
              onclick={() => setTheme(opt.id)}
              class="flex-1 rounded-lg py-2 text-xs transition-colors
                {$themeSetting === opt.id
                ? 'bg-raised font-medium text-ink shadow-sm'
                : 'text-soft hover:text-ink'}"
            >
              {opt.label}
            </button>
          {/each}
        </div>
      </div>
    </section>

    <section class="mb-7">
      <h2 class="mb-2.5 text-xs font-medium tracking-wide text-faint">数据</h2>
      <div class="flex flex-col gap-2 rounded-2xl border border-line bg-raised p-4">
        <button
          onclick={handleExport}
          disabled={exporting}
          class="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-strong disabled:opacity-50"
        >
          {exporting ? '导出中…' : '导出备份（ZIP）'}
        </button>
        <button
          onclick={() => fileInputEl?.click()}
          disabled={importing}
          class="rounded-xl border border-line px-4 py-2.5 text-sm text-ink transition-colors hover:bg-sunken disabled:opacity-50"
        >
          {importing ? '导入中…' : '导入备份（ZIP）'}
        </button>
        {#if usage}
          <p class="mt-1 text-center text-xs text-faint">
            存储占用：<span class="tnum">{usage}</span>
          </p>
        {/if}
      </div>
    </section>
  </div>
</div>

<input bind:this={fileInputEl} type="file" accept=".zip" onchange={handleImport} class="hidden" />
