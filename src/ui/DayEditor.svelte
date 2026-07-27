<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import type { LifeConfig } from '../domain/lifeConfig'
  import { dateOf } from '../domain/lifeConfig'
  import type { DayDoc } from '../storage/StorageBackend'

  let {
    dayIndex,
    config,
    onClose,
    onNavigate,
    onSave,
    readDay,
    readMedia,
    writeMedia,
    deleteMedia,
  }: {
    dayIndex: number
    config: LifeConfig
    onClose: () => void
    onNavigate: (index: number) => void
    onSave: (index: number, doc: DayDoc) => void
    readDay: (index: number) => Promise<DayDoc | null>
    readMedia: (dayIndex: number, id: string) => Promise<Blob | null>
    writeMedia: (dayIndex: number, id: string, blob: Blob) => Promise<void>
    deleteMedia: (dayIndex: number, id: string) => Promise<void>
  } = $props()

  type MediaMeta = { id: string; name: string; w: number; h: number; type: string }

  let dialogEl = $state<HTMLDialogElement | null>(null)
  let text = $state('')
  let media = $state<MediaMeta[]>([])
  let urls = $state<Record<string, string>>({})
  let saving = $state(false)
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let fileInputEl = $state<HTMLInputElement | null>(null)

  const date = $derived(dateOf(dayIndex, config))
  const dayLabel = $derived.by(() => {
    const d = date
    const days = ['日', '一', '二', '三', '四', '五', '六']
    return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日 星期${days[d.getUTCDay()]}`
  })
  const lifeDay = $derived(dayIndex + 1)

  const ageLabel = $derived.by(() => {
    const birth = new Date(config.birthdate + 'T00:00:00Z')
    const d = date
    let years = d.getUTCFullYear() - birth.getUTCFullYear()
    const m = d.getUTCMonth() - birth.getUTCMonth()
    if (m < 0 || (m === 0 && d.getUTCDate() < birth.getUTCDate())) {
      years--
    }
    return `${years} 岁`
  })

  async function loadDay(idx: number) {
    for (const u of Object.values(urls)) URL.revokeObjectURL(u)
    urls = {}
    const doc = await readDay(idx)
    text = doc?.text ?? ''
    media = doc?.media ?? []
    for (const m of media) {
      const blob = await readMedia(idx, m.id)
      if (blob) urls = { ...urls, [m.id]: URL.createObjectURL(blob) }
    }
  }

  $effect(() => {
    // dayIndex 变化（上一天/下一天）时重新加载
    const idx = dayIndex
    untrack(() => {
      loadDay(idx)
    })
  })

  function flushSave() {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
      onSave(dayIndex, { text, media, updatedAt: Date.now() })
    }
  }

  function debouncedSave() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = null
      saving = true
      onSave(dayIndex, { text, media, updatedAt: Date.now() })
      saving = false
    }, 500)
  }

  function handleTextInput(e: Event) {
    text = (e.target as HTMLTextAreaElement).value
    debouncedSave()
  }

  async function handleFileSelected(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    const id = crypto.randomUUID()
    const blob = new Blob([await file.arrayBuffer()], { type: file.type })
    const img = await createImageBitmap(blob)
    await writeMedia(dayIndex, id, blob)
    media = [...media, { id, name: file.name, w: img.width, h: img.height, type: file.type }]
    urls = { ...urls, [id]: URL.createObjectURL(blob) }
    img.close()
    debouncedSave()
    input.value = ''
  }

  async function handleRemoveImage(id: string) {
    await deleteMedia(dayIndex, id)
    if (urls[id]) {
      URL.revokeObjectURL(urls[id])
      const rest = { ...urls }
      delete rest[id]
      urls = rest
    }
    media = media.filter((m) => m.id !== id)
    debouncedSave()
  }

  function handlePrev() {
    if (dayIndex > 0) {
      flushSave()
      onNavigate(dayIndex - 1)
    }
  }

  function handleNext() {
    flushSave()
    onNavigate(dayIndex + 1)
  }

  function close() {
    flushSave()
    for (const u of Object.values(urls)) URL.revokeObjectURL(u)
    dialogEl?.close()
    onClose()
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === dialogEl) close()
  }

  onMount(() => {
    dialogEl?.showModal()
  })
</script>

<dialog
  bind:this={dialogEl}
  onclose={close}
  onclick={handleBackdropClick}
  class="mx-0 mb-0 mt-auto h-[92dvh] w-full max-w-none rounded-t-3xl border border-line bg-raised p-0 text-ink shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm sm:m-auto sm:h-auto sm:max-h-[85dvh] sm:w-[520px] sm:rounded-3xl"
>
  <div class="flex h-full flex-col gap-4 overflow-y-auto p-6">
    <div class="flex items-start justify-between">
      <div>
        <div class="text-base font-medium">{dayLabel}</div>
        <div class="mt-0.5 text-xs text-faint">
          {ageLabel} · 人生第 <span class="tnum">{lifeDay.toLocaleString()}</span> 天
        </div>
      </div>
      <button
        onclick={close}
        aria-label="关闭"
        class="rounded-lg p-1.5 text-faint transition-colors hover:bg-sunken hover:text-ink"
      >
        <svg
          class="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.8"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <textarea
      value={text}
      oninput={handleTextInput}
      placeholder="这一天，发生了什么…"
      class="min-h-40 w-full flex-1 resize-none rounded-2xl border border-line bg-sunken p-4 text-sm leading-relaxed text-ink placeholder-faint focus:border-accent focus:outline-none"
    ></textarea>

    {#if media.length > 0}
      <div class="grid grid-cols-3 gap-2">
        {#each media as m (m.id)}
          <div class="group relative aspect-square overflow-hidden rounded-xl bg-sunken">
            {#if urls[m.id]}
              <img src={urls[m.id]} alt={m.name} class="h-full w-full object-cover" />
            {/if}
            <button
              onclick={() => handleRemoveImage(m.id)}
              aria-label="删除图片"
              class="absolute right-1.5 top-1.5 rounded-full bg-black/55 p-1 text-white opacity-0 transition-opacity hover:bg-black/75 group-hover:opacity-100"
            >
              <svg
                class="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        {/each}
      </div>
    {/if}

    <div class="flex items-center gap-1">
      <button
        onclick={handlePrev}
        disabled={dayIndex <= 0}
        class="rounded-lg px-3 py-2 text-xs text-soft transition-colors hover:bg-sunken hover:text-ink disabled:opacity-30"
      >
        ← 上一天
      </button>
      <button
        onclick={handleNext}
        class="rounded-lg px-3 py-2 text-xs text-soft transition-colors hover:bg-sunken hover:text-ink"
      >
        下一天 →
      </button>
      <div class="flex-1"></div>
      {#if saving}
        <span class="text-xs text-faint">保存中…</span>
      {/if}
      <button
        onclick={() => fileInputEl?.click()}
        class="rounded-lg px-3 py-2 text-xs text-accent transition-colors hover:bg-accent-soft"
      >
        添加图片
      </button>
    </div>
  </div>
</dialog>

<input
  bind:this={fileInputEl}
  type="file"
  accept="image/*"
  onchange={handleFileSelected}
  class="hidden"
/>
