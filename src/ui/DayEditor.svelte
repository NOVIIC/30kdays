<script lang="ts">
  import { onMount } from 'svelte'
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
  }: {
    dayIndex: number
    config: LifeConfig
    onClose: () => void
    onNavigate: (index: number) => void
    onSave: (index: number, doc: DayDoc) => void
    readDay: (index: number) => Promise<DayDoc | null>
  } = $props()

  let dialogEl = $state<HTMLDialogElement | null>(null)
  let text = $state('')
  let media = $state<{ id: string; name: string; w: number; h: number; type: string }[]>([])
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

  let ageLabel = $derived.by(() => {
    const birth = new Date(config.birthdate + 'T00:00:00Z')
    const d = date
    let years = d.getUTCFullYear() - birth.getUTCFullYear()
    const m = d.getUTCMonth() - birth.getUTCMonth()
    if (m < 0 || (m === 0 && d.getUTCDate() < birth.getUTCDate())) {
      years--
    }
    return `${years} 岁`
  })

  onMount(async () => {
    const doc = await readDay(dayIndex)
    if (doc) {
      text = doc.text
      media = doc.media
    }
  })

  function debouncedSave() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saving = true
      onSave(dayIndex, {
        text,
        media,
        updatedAt: Date.now(),
      })
      saving = false
    }, 500)
  }

  function handleTextInput(e: Event) {
    text = (e.target as HTMLTextAreaElement).value
    debouncedSave()
  }

  async function handleAddImage() {
    fileInputEl?.click()
  }

  async function handleFileSelected(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    const id = crypto.randomUUID()
    const blob = new Blob([await file.arrayBuffer()], { type: file.type })
    const img = await createImageBitmap(blob)
    media = [...media, { id, name: file.name, w: img.width, h: img.height, type: file.type }]
    img.close()
    // Store the media blob (caller handles actual storage)
    debouncedSave()
    input.value = ''
  }

  function handleRemoveImage(id: string) {
    media = media.filter((m) => m.id !== id)
    debouncedSave()
  }

  function handlePrev() {
    if (dayIndex > 0) onNavigate(dayIndex - 1)
  }

  function handleNext() {
    onNavigate(dayIndex + 1)
  }

  function open() {
    dialogEl?.showModal()
  }

  function close() {
    // Flush pending saves
    if (saveTimer) {
      clearTimeout(saveTimer)
      onSave(dayIndex, { text, media, updatedAt: Date.now() })
    }
    dialogEl?.close()
    onClose()
  }

  onMount(() => {
    open()
  })
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<dialog
  bind:this={dialogEl}
  onclose={close}
  class="mx-0 mt-auto h-[90dvh] w-full max-w-none rounded-t-2xl border-0 bg-gray-900 p-0 text-white backdrop:bg-black/50 sm:mx-auto sm:mb-auto sm:mt-auto sm:h-auto sm:max-h-[90dvh] sm:w-[480px] sm:rounded-2xl"
>
  <div class="flex flex-col gap-4 p-6">
    <div class="flex items-center justify-between">
      <div>
        <div class="text-lg font-medium">{dayLabel}</div>
        <div class="text-sm text-gray-400">
          {ageLabel} · 人生第 {lifeDay.toLocaleString()} 天
        </div>
      </div>
      <button
        onclick={close}
        aria-label="关闭"
        class="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
      >
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <textarea
      value={text}
      oninput={handleTextInput}
      placeholder="记录今天..."
      class="h-40 w-full resize-none rounded-lg border border-gray-700 bg-gray-800 p-4 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
    ></textarea>

    {#if media.length > 0}
      <div class="grid grid-cols-3 gap-2">
        {#each media as m (m.id)}
          <div class="relative aspect-square overflow-hidden rounded-lg bg-gray-800">
            <img
              src={URL.createObjectURL(new Blob())}
              alt={m.name}
              class="h-full w-full object-cover"
            />
            <button
              onclick={() => handleRemoveImage(m.id)}
              aria-label="删除图片"
              class="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
            >
              <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        {/each}
      </div>
    {/if}

    <div class="flex items-center gap-3">
      <button
        onclick={handlePrev}
        disabled={dayIndex <= 0}
        class="rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white disabled:opacity-30"
      >
        上一天
      </button>
      <button
        onclick={handleNext}
        class="rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white"
      >
        下一天
      </button>
      <div class="flex-1"></div>
      <button
        onclick={handleAddImage}
        class="rounded-lg px-4 py-2 text-sm text-indigo-400 hover:bg-gray-800"
      >
        添加图片
      </button>
      {#if saving}
        <span class="text-xs text-gray-500">保存中...</span>
      {/if}
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
