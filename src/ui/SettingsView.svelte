<script lang="ts">
  /**
   * 设置视图：人生（预期寿命）与外观（主题）。
   * 数据（存储占用 / 导入导出 / 同步）分区随存储层落地后加入。
   */
  import { createLifeConfig, type LifeConfig } from '../core/domain'
  import { config } from '../stores/config'
  import { setTheme, themeSetting, type ThemeSetting } from '../stores/theme'

  const themeOptions: { id: ThemeSetting; label: string }[] = [
    { id: 'light', label: '浅色' },
    { id: 'dark', label: '深色' },
    { id: 'system', label: '跟随系统' },
  ]

  let lifespan = $state($config?.lifespanYears ?? 80)

  /** 拖动结束后提交新寿命（内存态）。 */
  function applyLifespan() {
    const c = $config
    if (!c || lifespan === c.lifespanYears) return
    const next: LifeConfig = createLifeConfig(c.birthdate, lifespan)
    config.set(next)
  }
</script>

<div class="h-full overflow-y-auto">
  <div class="mx-auto max-w-2xl px-5 pb-28 pt-8 md:pb-12">
    <h1 class="mb-6 text-xl font-medium tracking-tight">设置</h1>

    <section class="mb-7">
      <h2 class="mb-2.5 text-xs font-medium tracking-wide text-faint">人生</h2>
      <div class="rounded-2xl border border-line bg-raised p-4">
        <div class="flex items-baseline justify-between">
          <span class="text-sm">预期寿命</span>
          <span class="text-sm text-soft">
            <span class="tnum font-medium text-ink">{lifespan}</span> 岁 · 约
            <span class="tnum">{Math.round(lifespan * 365.25).toLocaleString()}</span> 天
          </span>
        </div>
        <input
          type="range"
          min="50"
          max="120"
          bind:value={lifespan}
          onchange={applyLifespan}
          class="mt-3 w-full accent-(--accent)"
        />
      </div>
    </section>

    <section class="mb-7">
      <h2 class="mb-2.5 text-xs font-medium tracking-wide text-faint">外观</h2>
      <div class="rounded-2xl border border-line bg-raised p-4">
        <div class="flex rounded-xl border border-line bg-sunken p-1">
          {#each themeOptions as opt (opt.id)}
            <button
              onclick={() => setTheme(opt.id)}
              class="flex-1 rounded-lg py-2 text-xs transition-colors
                {$themeSetting === opt.id
                ? 'bg-raised font-medium text-ink shadow-sm'
                : 'text-soft hover:text-ink'}"
            >
              {opt.label}
            </button>
          {/each}
        </div>
      </div>
    </section>
  </div>
</div>
