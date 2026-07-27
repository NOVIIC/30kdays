<script lang="ts">
  import { createMemo, type Memo } from '../domain/memo'
  import { memos, addMemo, updateMemo, removeMemo } from '../stores/memos'

  let editingId = $state<string | null>(null)
  let draft = $state('')

  function formatTime(ts: number): string {
    const d = new Date(ts)
    const now = new Date()
    const sameYear = d.getFullYear() === now.getFullYear()
    const date = sameYear
      ? `${d.getMonth() + 1}月${d.getDate()}日`
      : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    return `${date} ${time}`
  }

  function startEdit(m: Memo) {
    editingId = m.id
    draft = m.text
  }

  function commitEdit() {
    if (editingId === null) return
    const m = $memos.find((x) => x.id === editingId)
    if (m && draft.trim() !== m.text) {
      updateMemo({ ...m, text: draft.trim(), updatedAt: Date.now() })
    }
    editingId = null
  }

  function handleNew() {
    const m = createMemo('')
    addMemo(m)
    editingId = m.id
    draft = ''
  }

  function handleDelete(id: string) {
    if (editingId === id) editingId = null
    removeMemo(id)
  }
</script>

<div class="h-full overflow-y-auto">
  <div class="mx-auto max-w-2xl px-5 pb-28 pt-8 md:pb-12">
    <div class="mb-6 flex items-end justify-between">
      <div>
        <h1 class="text-xl font-medium tracking-tight">备忘</h1>
        <p class="mt-1 text-xs text-faint">随手记下的碎片</p>
      </div>
      <button
        onclick={handleNew}
        class="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-strong"
      >
        新建
      </button>
    </div>

    {#if $memos.length === 0}
      <div class="mt-24 flex flex-col items-center gap-3 text-center">
        <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-sunken text-faint">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            class="h-6 w-6"
          >
            <path
              d="M6 3.5h9L19 7.5V20a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V5a1.5 1.5 0 0 1 1-1.5Z"
              stroke-linejoin="round"
            />
            <path d="M9 11h6M9 15h4" stroke-linecap="round" />
          </svg>
        </div>
        <p class="text-sm text-faint">还没有备忘<br />一闪而过的念头，先记下来</p>
      </div>
    {/if}

    <ul class="flex flex-col gap-3">
      {#each $memos as m (m.id)}
        <li class="group relative rounded-2xl border border-line bg-raised p-4">
          {#if editingId === m.id}
            <textarea
              bind:value={draft}
              onblur={commitEdit}
              autofocus
              rows="3"
              placeholder="记点什么…"
              class="w-full resize-y rounded-lg border border-line bg-sunken p-3 text-sm leading-relaxed text-ink focus:border-accent focus:outline-none"
            ></textarea>
            <div class="mt-2 flex justify-end gap-2">
              <button
                onclick={commitEdit}
                class="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-contrast hover:bg-accent-strong"
              >
                完成
              </button>
            </div>
          {:else}
            <button onclick={() => startEdit(m)} class="block w-full text-left">
              <p class="whitespace-pre-wrap text-sm leading-relaxed text-ink">{m.text}</p>
              <p class="mt-2 text-[11px] text-faint">{formatTime(m.updatedAt)}</p>
            </button>
            <button
              onclick={() => handleDelete(m.id)}
              aria-label="删除"
              class="absolute right-2.5 top-2.5 rounded-lg p-1.5 text-faint opacity-0 transition-opacity hover:bg-danger-soft hover:text-danger group-hover:opacity-100"
            >
              <svg
                class="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
              >
                <path
                  d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  </div>
</div>
