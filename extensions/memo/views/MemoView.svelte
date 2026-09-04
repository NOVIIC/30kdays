<script lang="ts">
  /**
   * 备忘扩展主视图：纯文本备忘列表（updatedAt 倒序），就地编辑、防抖自动保存；
   * 新建置顶多亏 store.addMemo（首次输入才落盘，失焦为空则丢弃）；
   * 删除为原位二次确认（点一次变「确认删除？」，3 秒无操作或移出卡片复原）。
   * 数据读写全部经 Host API（context.fs，memos/<id>.json 一备忘一文件），见 ../src/store.ts。
   */
  import { onDestroy, onMount, tick } from 'svelte'
  import type { ExtensionContext } from '../../../src/core/host'
  import { formatMemoTime } from '../src/memos'
  import {
    addMemo,
    blurMemo,
    flushAll,
    loadMemos,
    memos,
    removeMemo,
    saveErrors,
    updateMemoText,
  } from '../src/store'

  let { context }: { context: ExtensionContext } = $props()

  /** 删除二次确认：当前处于待确认态的备忘 id。 */
  let confirmingId = $state<string | null>(null)
  let confirmTimer: ReturnType<typeof setTimeout> | null = null

  /** 复位删除确认态（含定时器清理）。 */
  function resetConfirm(): void {
    if (confirmTimer !== null) {
      clearTimeout(confirmTimer)
      confirmTimer = null
    }
    confirmingId = null
  }

  /** 删除按钮点击：首次进入待确认态（3 秒自动复原），再次点击真删。 */
  function onDeleteClick(id: string): void {
    if (confirmingId !== id) {
      resetConfirm()
      confirmingId = id
      confirmTimer = setTimeout(resetConfirm, 3000)
      return
    }
    resetConfirm()
    void removeMemo(context, id)
  }

  /** 新建备忘并聚焦其输入框。 */
  async function onAdd(): Promise<void> {
    const id = addMemo()
    await tick()
    document.getElementById(`memo-text-${id}`)?.focus()
  }

  /** Svelte action：让 textarea 随内容自动增高。 */
  function autosize(node: HTMLTextAreaElement) {
    const resize = () => {
      node.style.height = 'auto'
      node.style.height = `${node.scrollHeight}px`
    }
    resize()
    node.addEventListener('input', resize)
    return { destroy: () => node.removeEventListener('input', resize) }
  }

  onMount(() => {
    void loadMemos(context)
  })
  onDestroy(() => {
    resetConfirm()
    void flushAll(context)
  })
</script>

<div class="h-full overflow-y-auto">
  <div class="mx-auto max-w-2xl px-5 pb-28 pt-8 md:pb-12">
    <header class="mb-6 flex items-center justify-between">
      <h1 class="text-lg font-medium">备忘</h1>
      <button
        onclick={() => void onAdd()}
        class="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-strong"
      >
        新建备忘
      </button>
    </header>

    {#if $memos === null}
      <p class="py-16 text-center text-sm text-faint">载入中…</p>
    {:else if $memos.length === 0}
      <p class="py-16 text-center text-sm text-faint">还没有备忘，点「新建备忘」记一条。</p>
    {:else}
      <ul class="flex flex-col gap-3">
        {#each $memos as memo (memo.id)}
          <li
            class="group rounded-xl border border-line bg-raised px-4 py-3"
            onpointerleave={() => {
              if (confirmingId === memo.id) resetConfirm()
            }}
          >
            <textarea
              id="memo-text-{memo.id}"
              use:autosize
              class="block w-full resize-none overflow-hidden bg-transparent text-sm leading-relaxed outline-none placeholder:text-faint"
              placeholder="写点什么……"
              value={memo.text}
              oninput={(e) => updateMemoText(context, memo.id, e.currentTarget.value)}
              onblur={() => void blurMemo(context, memo.id)}></textarea>
            <div class="mt-2 flex items-center justify-between">
              <span class="tnum text-xs text-faint">
                {formatMemoTime(memo.updatedAt)}
                {#if $saveErrors.has(memo.id)}
                  <span class="ml-2 text-accent">保存失败，将重试</span>
                {/if}
              </span>
              <button
                onclick={() => onDeleteClick(memo.id)}
                class={[
                  'rounded-lg px-2 py-1 text-xs transition-colors',
                  confirmingId === memo.id
                    ? 'text-accent'
                    : 'text-faint hover:bg-bg hover:text-soft md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100',
                ]}
              >
                {confirmingId === memo.id ? '确认删除？' : '删除'}
              </button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>
