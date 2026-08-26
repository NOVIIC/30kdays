<script lang="ts">
  /**
   * 扩展视图宿主：懒加载视图组件并注入扩展上下文。
   * 加载失败由外层 <svelte:boundary> 兜底（见 App.svelte）。
   */
  import type { ContributedView } from '../core/host'
  import { getExtensionContext } from '../stores/host'

  let { view }: { view: ContributedView } = $props()

  const context = $derived(getExtensionContext(view.extId))
</script>

{#await view.load()}
  <div class="flex h-full items-center justify-center text-sm text-faint">载入中…</div>
{:then mod}
  {@const C = mod.default}
  <C {context} />
{/await}
