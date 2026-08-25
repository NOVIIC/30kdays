<script lang="ts">
  /**
   * 日记编辑器：原生 <dialog showModal>，由路由深链 ?d=<index>（stores/router.openDay）驱动；
   * 输入防抖自动保存（stores/day-editor），Esc / 点击遮罩 / 关闭按钮 / history 返回均关闭。
   */
  import { dateOf, totalDays } from '../core/domain'
  import { config } from '../stores/config'
  import {
    closeEditor,
    editorDoc,
    loadDay,
    saveState,
    updateText,
    type SaveState,
  } from '../stores/day-editor'
  import { closeDay, openDay } from '../stores/router'

  /** 保存状态的展示文案。 */
  const STATUS_TEXT: Record<SaveState, string> = {
    idle: '',
    dirty: '未保存',
    saving: '保存中…',
    saved: '已保存',
    error: '保存失败，将重试',
  }

  let dialog = $state<HTMLDialogElement | null>(null)
  let textarea = $state<HTMLTextAreaElement | null>(null)

  /** 标题：日期（越界深链会被 loadDay 关掉，此处先按越界判空避免 dateOf 抛错）。 */
  const title = $derived(
    $config !== null && $openDay !== null && $openDay < totalDays($config)
      ? dateOf($config, $openDay)
      : '',
  )

  // 深链驱动开关：打开时载入文档并 showModal；关闭时 flush 未保存内容并收起
  $effect(() => {
    const day = $openDay
    if (day === null) {
      if (dialog?.open) {
        void closeEditor()
        dialog.close()
      }
      return
    }
    void loadDay(day)
    if (dialog && !dialog.open) dialog.showModal()
  })

  // 文档载入后聚焦正文
  $effect(() => {
    if ($editorDoc !== null) textarea?.focus()
  })
</script>

<dialog
  bind:this={dialog}
  oncancel={(e) => {
    e.preventDefault()
    closeDay()
  }}
  onclick={(e) => {
    // 点击遮罩（dialog 元素本身）关闭；内容区点击不穿透
    if (e.target === dialog) closeDay()
  }}
  class="fixed inset-0 m-auto h-fit w-full max-w-xl rounded-2xl border border-line bg-raised p-0 text-ink shadow-xl backdrop:bg-black/30"
>
  <div class="flex h-[70vh] flex-col">
    <header class="flex items-center justify-between border-b border-line px-5 py-3">
      <div>
        <h2 class="tnum text-sm font-medium">{title}</h2>
        {#if $openDay !== null}
          <p class="tnum text-xs text-faint">第 {$openDay + 1} 天</p>
        {/if}
      </div>
      <div class="flex items-center gap-3">
        <span class="text-xs text-faint">{STATUS_TEXT[$saveState]}</span>
        <button
          onclick={() => closeDay()}
          aria-label="关闭"
          class="rounded-lg px-2 py-1 text-sm text-soft transition-colors hover:bg-bg hover:text-ink"
        >
          ✕
        </button>
      </div>
    </header>
    {#if $editorDoc !== null}
      <textarea
        bind:this={textarea}
        class="min-h-0 flex-1 resize-none bg-transparent px-5 py-4 text-sm leading-relaxed outline-none placeholder:text-faint"
        placeholder="这一天……"
        value={$editorDoc.text}
        oninput={(e) => updateText(e.currentTarget.value)}></textarea>
    {:else}
      <div class="flex flex-1 items-center justify-center text-sm text-faint">载入中…</div>
    {/if}
  </div>
</dialog>
