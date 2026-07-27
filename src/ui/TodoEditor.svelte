<script lang="ts">
  import { onMount } from 'svelte'
  import {
    createTodo,
    validateSchedule,
    todayString,
    offsetDateString,
    daysBetween,
    type Todo,
    type TodoSchedule,
  } from '../domain/todo'

  let {
    initial,
    onSave,
    onDelete,
    onClose,
  }: {
    initial: Todo | null
    onSave: (t: Todo) => void
    onDelete: ((id: string) => void) | null
    onClose: () => void
  } = $props()

  type Kind = TodoSchedule['kind']

  const today = todayString()

  let dialogEl = $state<HTMLDialogElement | null>(null)
  let title = $state(initial?.title ?? '')
  let kind = $state<Kind>(initial?.schedule.kind ?? 'none')
  let due = $state(initial?.schedule.kind === 'deadline' ? initial.schedule.due : today)
  let start = $state(initial?.schedule.kind === 'range' ? initial.schedule.start : today)
  let end = $state(initial?.schedule.kind === 'range' ? initial.schedule.end : offsetDateString(29))
  let requiredDays = $state(initial?.schedule.kind === 'range' ? initial.schedule.requiredDays : 10)
  let error = $state('')

  const spanDays = $derived(kind === 'range' && start && end ? daysBetween(start, end) + 1 : 0)

  function buildSchedule(): TodoSchedule {
    if (kind === 'deadline') return { kind: 'deadline', due }
    if (kind === 'range') return { kind: 'range', start, end, requiredDays }
    return { kind: 'none' }
  }

  function handleSave() {
    if (!title.trim()) {
      error = '请填写标题'
      return
    }
    const schedule = buildSchedule()
    const err = validateSchedule(schedule)
    if (err) {
      error = err
      return
    }
    const todo: Todo = initial
      ? { ...initial, title: title.trim(), schedule }
      : createTodo(title.trim(), schedule)
    onSave(todo)
    dialogEl?.close()
    onClose()
  }

  function handleDelete() {
    if (initial && onDelete) {
      onDelete(initial.id)
      dialogEl?.close()
      onClose()
    }
  }

  function close() {
    dialogEl?.close()
    onClose()
  }

  onMount(() => {
    dialogEl?.showModal()
  })

  const kindOptions: { id: Kind; label: string }[] = [
    { id: 'none', label: '无日期' },
    { id: 'deadline', label: '截止日' },
    { id: 'range', label: '区间打卡' },
  ]

  const inputCls =
    'w-full rounded-xl border border-line bg-sunken px-3.5 py-2.5 text-sm text-ink focus:border-accent focus:outline-none'
</script>

<dialog
  bind:this={dialogEl}
  onclose={onClose}
  class="m-auto w-[min(92vw,420px)] rounded-2xl border border-line bg-raised p-0 text-ink shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm"
>
  <form
    class="flex flex-col gap-5 p-6"
    onsubmit={(e) => {
      e.preventDefault()
      handleSave()
    }}
  >
    <div class="flex items-center justify-between">
      <h2 class="text-base font-medium">{initial ? '编辑待办' : '新建待办'}</h2>
      <button
        type="button"
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

    <input type="text" bind:value={title} placeholder="要做什么？" class={inputCls} autofocus />

    <div class="flex rounded-xl border border-line bg-sunken p-1">
      {#each kindOptions as opt (opt.id)}
        <button
          type="button"
          onclick={() => (kind = opt.id)}
          class="flex-1 rounded-lg py-1.5 text-xs transition-colors
            {kind === opt.id
            ? 'bg-raised font-medium text-ink shadow-sm'
            : 'text-soft hover:text-ink'}"
        >
          {opt.label}
        </button>
      {/each}
    </div>

    {#if kind === 'deadline'}
      <label class="flex flex-col gap-1.5">
        <span class="text-xs text-soft">截止日期</span>
        <input type="date" bind:value={due} class={inputCls} />
      </label>
    {:else if kind === 'range'}
      <div class="flex gap-3">
        <label class="flex flex-1 flex-col gap-1.5">
          <span class="text-xs text-soft">起始日</span>
          <input type="date" bind:value={start} class={inputCls} />
        </label>
        <label class="flex flex-1 flex-col gap-1.5">
          <span class="text-xs text-soft">结束日</span>
          <input type="date" bind:value={end} class={inputCls} />
        </label>
      </div>
      <label class="flex flex-col gap-1.5">
        <span class="text-xs text-soft">
          所需天数{#if spanDays > 0}<span class="text-faint">（区间共 {spanDays} 天）</span>{/if}
        </span>
        <input type="number" min="1" bind:value={requiredDays} class={inputCls} />
      </label>
      <p class="text-xs leading-relaxed text-faint">
        区间内任意日期均可打卡，打卡满 {requiredDays} 天即完成；结束日仍未满则记为未达成。
      </p>
    {/if}

    {#if error}
      <p class="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>
    {/if}

    <div class="flex items-center gap-2">
      {#if initial && onDelete}
        <button
          type="button"
          onclick={handleDelete}
          class="rounded-xl px-3.5 py-2.5 text-sm text-danger transition-colors hover:bg-danger-soft"
        >
          删除
        </button>
      {/if}
      <div class="flex-1"></div>
      <button
        type="button"
        onclick={close}
        class="rounded-xl px-3.5 py-2.5 text-sm text-soft transition-colors hover:bg-sunken hover:text-ink"
      >
        取消
      </button>
      <button
        type="submit"
        class="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-strong"
      >
        保存
      </button>
    </div>
  </form>
</dialog>
