<script lang="ts">
  /**
   * 备忘扩展占位视图：验证视图贡献链路
   * （静态注册 → 导航/路由 → 懒加载渲染 → Host API 注入）。
   * 备忘功能本体随阶段 2 落地（就地编辑、updatedAt 倒序，见 ARCHITECTURE.md §9.2）。
   */
  import type { ExtensionContext } from '../../../src/core/host'

  let { context }: { context: ExtensionContext } = $props()
</script>

<div class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
  <h1 class="text-lg font-medium">备忘</h1>
  <p class="text-sm text-faint">扩展（{context.extId}）占位视图，功能随阶段 2 落地。</p>
  {#await context.fs.listDir() then listing}
    <p class="text-xs text-faint">
      扩展数据：{listing === null ? 0 : listing.dirs.length + listing.files.length} 项
    </p>
  {/await}
</div>
