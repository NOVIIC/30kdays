<script lang="ts">
  import { onMount } from 'svelte'

  let {
    config,
    onClose,
    onConfigChange,
    onExport,
    onImport,
  }: {
    config: { lifespanYears: number } | null
    onClose: () => void
    onConfigChange: (lifespan: number) => Promise<void>
    onExport: () => Promise<void>
    onImport: (file: File) => Promise<void>
  } = $props()

  let lifespan = $state(80)
  let usage = $state('')
  let exporting = $state(false)
  let importing = $state(false)

  $effect(() => {
    lifespan = config?.lifespanYears ?? 80
  })

  let fileInputEl = $state<HTMLInputElement | null>(null)

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

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<dialog
  onclose={onClose}
  open
  class="mx-0 mt-auto h-[90dvh] w-full max-w-none rounded-t-2xl border-0 bg-gray-900 p-0 text-white backdrop:bg-black/50 sm:mx-auto sm:mb-auto sm:mt-auto sm:h-auto sm:w-[420px] sm:rounded-2xl"
>
  <div class="flex flex-col gap-6 p-6">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-medium">设置</h2>
      <button
        onclick={onClose}
        aria-label="关闭"
        class="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
      >
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <label class="flex flex-col gap-2">
      <span class="text-sm text-gray-300">预期寿命：{lifespan} 岁</span>
      <input
        type="range"
        min="50"
        max="120"
        bind:value={lifespan}
        onchange={async () => {
          if (lifespan !== config?.lifespanYears) {
            await onConfigChange(lifespan)
          }
        }}
        class="accent-indigo-500"
      />
    </label>

    <div class="flex flex-col gap-3">
      <button
        onclick={handleExport}
        disabled={exporting}
        class="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {exporting ? '导出中...' : '导出备份 (ZIP)'}
      </button>
      <button
        onclick={() => fileInputEl?.click()}
        disabled={importing}
        class="rounded-lg bg-gray-700 px-4 py-2.5 text-sm text-white hover:bg-gray-600 disabled:opacity-50"
      >
        {importing ? '导入中...' : '导入备份 (ZIP)'}
      </button>
    </div>

    {#if usage}
      <div class="text-center text-xs text-gray-500">存储占用：{usage}</div>
    {/if}
  </div>
</dialog>

<input
  bind:this={fileInputEl}
  type="file"
  accept=".zip"
  onchange={handleImport}
  class="hidden"
/>
