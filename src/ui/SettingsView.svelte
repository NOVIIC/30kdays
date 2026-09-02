<script lang="ts">
  /**
   * 设置视图：人生（预期寿命展示）、外观（主题）与存储（占用、持久化）。
   * 存储占用经 backend.estimateUsage() 获取（本应用数据的实际占用，含分模块明细），
   * 配额按 1 GiB 上限展示；持久化状态见 stores/storage。
   * 底部展示应用版本号（取自 package.json，为发版版本号的单一来源）。
   */
  import { onMount } from 'svelte'
  import { version } from '../../package.json'
  import type { StorageBreakdown, StorageUsage } from '../core/storage'
  import { config } from '../stores/config'
  import { getBackend, requestPersistence, storagePersisted } from '../stores/storage'
  import { setTheme, themeSetting, type ThemeSetting } from '../stores/theme'

  /** 占用展示用的配额上限（字节）：浏览器估计配额远超实际需求，按 1 GiB 封顶展示。 */
  const DISPLAY_QUOTA_CAP = 1024 ** 3

  /** 存储分模块展示定义：堆叠条分段顺序与 accent 不透明度（单色渐变配色）。 */
  const MODULES: { key: keyof StorageBreakdown; label: string; opacity: number }[] = [
    { key: 'media', label: '媒体', opacity: 1 },
    { key: 'days', label: '日记', opacity: 0.65 },
    { key: 'ext', label: '扩展', opacity: 0.4 },
    { key: 'system', label: '索引与配置', opacity: 0.2 },
  ]

  const themeOptions: { id: ThemeSetting; label: string }[] = [
    { id: 'light', label: '浅色' },
    { id: 'dark', label: '深色' },
    { id: 'system', label: '跟随系统' },
  ]

  let lifespan = $derived($config?.lifespanYears ?? 80)

  /** 存储用量；null 表示统计中。 */
  let usage = $state<StorageUsage | null>(null)
  /** 用量获取失败标记（展示重试入口）。 */
  let usageError = $state(false)
  /** 持久化申请中标记（防重复点击）。 */
  let requesting = $state(false)
  /** 手动申请被浏览器拒绝标记（展示提示文案；授权后随 storagePersisted 变为无关状态）。 */
  let requestDenied = $state(false)

  /** 展示用配额：浏览器估计值按 1 GiB 封顶。 */
  const displayQuota = $derived(Math.min(usage?.quota ?? DISPLAY_QUOTA_CAP, DISPLAY_QUOTA_CAP))
  /** 占用百分比（0–100）。 */
  const usagePercent = $derived(
    usage === null ? 0 : Math.min(100, (usage.usage / displayQuota) * 100),
  )
  /** 各模块占用行（按字节降序），pct 为占总用量的百分比。 */
  const moduleRows = $derived.by(() => {
    const u = usage
    if (u === null) return []
    return MODULES.map((m) => ({
      ...m,
      bytes: u.breakdown[m.key],
      pct: u.usage > 0 ? (u.breakdown[m.key] / u.usage) * 100 : 0,
    })).sort((a, b) => b.bytes - a.bytes)
  })

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

  /** 手动申请持久化存储：授权结果由 storagePersisted 反映到界面，拒绝时展示提示文案。 */
  async function applyPersistence() {
    if (requesting) return
    requesting = true
    try {
      requestDenied = !(await requestPersistence())
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
          <!-- 条长为总占用率（usage/quota），已用部分内部按模块分段堆叠 -->
          <div class="flex h-full" style:width="{usagePercent}%">
            {#each MODULES as m (m.key)}
              {@const w =
                usage !== null && usage.usage > 0
                  ? (usage.breakdown[m.key] / usage.usage) * 100
                  : 0}
              <div class="h-full bg-(--accent)" style:width="{w}%" style:opacity={m.opacity}></div>
            {/each}
          </div>
        </div>
        {#if usage}
          <ul class="mt-3 space-y-1.5">
            {#each moduleRows as m (m.key)}
              <li class="flex items-baseline justify-between text-xs">
                <span class="flex items-center gap-1.5 text-soft">
                  <span
                    class="inline-block size-2 rounded-full bg-(--accent)"
                    style:opacity={m.opacity}
                  ></span>
                  {m.label}
                </span>
                <span class="tnum text-faint">
                  {formatBytes(m.bytes)} · {formatPercent(m.pct, m.bytes)}
                </span>
              </li>
            {/each}
          </ul>
        {/if}
        <p class="mt-2 text-xs text-faint">用量为本应用数据的实际占用；配额按 1 GB 上限展示。</p>

        {#if $storagePersisted !== null}
          <div class="mt-4 flex items-baseline justify-between border-t border-line pt-4">
            <span class="text-sm">持久化存储</span>
            {#if $storagePersisted}
              <span class="text-sm text-soft">已开启，浏览器不会轻易清除本站数据</span>
            {:else}
              <div class="flex flex-col items-end gap-1">
                <button
                  onclick={() => void applyPersistence()}
                  disabled={requesting}
                  class="rounded-lg border border-line px-3 py-1.5 text-xs text-soft transition-colors
                    hover:text-ink disabled:opacity-50"
                >
                  {requesting ? '申请中…' : '申请持久化'}
                </button>
                {#if requestDenied}
                  <p class="max-w-52 text-right text-xs text-faint">
                    浏览器拒绝了申请。多访问几次、或将本站安装为应用后可提高通过率。
                  </p>
                {/if}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </section>

    <p class="mt-10 text-center text-xs text-faint">30kdays v{version}</p>
  </div>
</div>
