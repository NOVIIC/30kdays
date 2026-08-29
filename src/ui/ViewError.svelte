<script lang="ts">
  /**
   * 视图错误兜底：配合 <svelte:boundary> 的 failed snippet 使用。
   * 展示失败原因（可选）与重试按钮，重试即调用 boundary 的 reset 重建视图。
   */
  interface Props {
    /** 展示给用户的失败说明。 */
    message: string
    /** 重试回调，一般为 boundary failed snippet 的 reset。 */
    onreset: () => void
  }

  const { message, onreset }: Props = $props()
</script>

<div class="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
  <p class="text-sm">{message}</p>
  <button
    class="rounded-xl bg-accent px-6 py-2.5 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-strong"
    onclick={onreset}
  >
    重试
  </button>
</div>
