<script lang="ts">
  /**
   * 设置视图：人生（预期寿命）、外观（主题）与存储（占用、持久化）。
   * 存储占用经 backend.estimateUsage() 获取（整个浏览器源的估计值），
   * 配额按 1 GiB 上限展示；持久化状态见 stores/storage。
   */
  import { onMount } from 'svelte'
  import { createLifeConfig, type LifeConfig } from '../core/domain'
  import type { StorageUsage } from '../core/storage'
  import { config } from '../stores/config'
  import {
    getBackend,
    requestPersistence,
    storagePersisted,
    updateLifeConfig,
  } from '../stores/storage'
  import { setTheme, themeSetting, type ThemeSetting } from '../stores/theme'

  /** 占用展示用的配额上限（字节）：浏览器估计配额远超实际需求，按 1 GiB 封顶展示。 */
  const DISPLAY_QUOTA_CAP = 1024 ** 3

  const themeOptions: { id: ThemeSetting; label: string }[] = [
    { id: 'light', label: '浅色' },
    { id: 'dark', label: '深色' },
    { id: 'system', label: '跟随系统' },
  ]

  let lifespan = $state($config?.lifespanYears ?? 80)
  let applying = $state(false)

  /** 存储用量；null 表示统计中。 */
  let usage = $state<StorageUsage | null>(null)
  /** 用量获取失败标记（展示重试入口）。 */
  let usageError = $state(false)
  /** 持久化申请中标记（防重复点击）。 */
  let requesting = $state(false)

  /** 展示用配额：浏览器估计值按 1 GiB 封顶。 */
  const displayQuota = $derived(Math.min(usage?.quota ?? DISPLAY_QUOTA_CAP, DISPLAY_QUOTA_CAP))
  /** 占用百分比（0–100）。 */
  const usagePercent = $derived(
    usage === null ? 0 : Math.min(100, (usage.usage / displayQuota) * 100),
  )

  /** 进入设置页时统计一次存储用量。 */
  onMount(() => {
    void refreshUsage()
  })

  /** 拉取存储用量估计；失败置错误态以展示重试入口。 */
  async function refreshUsage() {
    usageError = false
    try {
      usage = await getBackend().estimateUsage()
    } catch {
      usageError = true
    }
  }

  /** 手动申请持久化存储，结果由 storagePersisted 反映到界面。 */
  async function applyPersistence() {
    if (requesting) return
    requesting = true
    try {
      await requestPersistence()
    } finally {
      requesting = false
    }
  }

  /** 格式化字节数为 B/KB/MB/GB（1024 进制，保留一位小数）。 */
  function formatBytes(n: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let v = n
    let i = 0
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024
      i++
    }
    return `${i === 0 ? v : v.toFixed(1)} ${units[i]}`
  }

  /** 格式化占用百分比：小于 0.1% 且非零时显示 <0.1%。 */
  function formatPercent(pct: number, bytes: number): string {
    return bytes > 0 && pct < 0.1 ? '<0.1%' : `${pct.toFixed(1)}%`
  }

  /** 拖动结束后提交新寿命：写盘并迁移日索引（见 stores/storage）。 */
  async function applyLifespan() {
    const c = $config
    if (!c || applying || lifespan === c.lifespanYears) return
    applying = true
    try {
      const next: LifeConfig = createLifeConfig(c.birthdate, lifespan)
      await updateLifeConfig(next)
    } finally {
      applying = false
    }
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

    <section class="mb-7">
      <h2 class="mb-2.5 text-xs font-medium tracking-wide text-faint">存储</h2>
      <div class="rounded-2xl border border-line bg-raised p-4">
        <div class="flex items-baseline justify-between">
          <span class="text-sm">存储占用</span>
          <span class="tnum text-sm text-soft">
            {#if usage}
              {formatBytes(usage.usage)} / {formatBytes(displayQuota)} · {formatPercent(
                usagePercent,
                usage.usage,
              )}
            {:else if usageError}
              获取失败
              <button onclick={() => void refreshUsage()} class="ml-1 text-(--accent) underline">
                重试
              </button>
            {:else}
              统计中…
            {/if}
          </span>
        </div>
        <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-sunken">
          <div class="h-full rounded-full bg-(--accent)" style:width="{usagePercent}%"></div>
        </div>
        <p class="mt-2 text-xs text-faint">用量为浏览器整个源的估计值；配额按 1 GB 上限展示。</p>

        {#if $storagePersisted !== null}
          <div class="mt-4 flex items-baseline justify-between border-t border-line pt-4">
            <span class="text-sm">持久化存储</span>
            {#if $storagePersisted}
              <span class="text-sm text-soft">已开启，浏览器不会轻易清除本站数据</span>
            {:else}
              <button
                onclick={() => void applyPersistence()}
                disabled={requesting}
                class="rounded-lg border border-line px-3 py-1.5 text-xs text-soft transition-colors
                  hover:text-ink disabled:opacity-50"
              >
                {requesting ? '申请中…' : '申请持久化'}
              </button>
            {/if}
          </div>
        {/if}
      </div>
    </section>
  </div>
</div>
