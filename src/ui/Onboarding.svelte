<script lang="ts">
  import type { LifeConfig } from '../domain/lifeConfig'

  let { onComplete = (_cfg: LifeConfig) => {} }: { onComplete?: (cfg: LifeConfig) => void } =
    $props()

  let birthdate = $state('2000-01-01')
  let lifespan = $state(80)
</script>

<div class="flex h-dvh flex-col items-center justify-center gap-10 bg-bg px-6">
  <div class="text-center">
    <div
      class="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-contrast"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" class="h-7 w-7">
        <circle cx="5" cy="5" r="1.6" /><circle cx="12" cy="5" r="1.6" /><circle
          cx="19"
          cy="5"
          r="1.6"
        />
        <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle
          cx="19"
          cy="12"
          r="1.6"
        />
        <circle cx="5" cy="19" r="1.6" /><circle cx="12" cy="19" r="1.6" /><circle
          cx="19"
          cy="19"
          r="1.6"
        />
      </svg>
    </div>
    <h1 class="text-2xl font-light tracking-wide text-ink">人生日历</h1>
    <p class="mt-2 text-sm text-soft">一生大约三万天，把每一天都铺在你眼前</p>
  </div>

  <div class="flex w-full max-w-xs flex-col gap-6">
    <label class="flex flex-col gap-2">
      <span class="text-xs font-medium text-soft">出生日期</span>
      <input
        type="date"
        bind:value={birthdate}
        class="rounded-xl border border-line bg-raised px-4 py-3 text-sm text-ink focus:border-accent focus:outline-none"
      />
    </label>

    <label class="flex flex-col gap-2">
      <span class="text-xs font-medium text-soft">
        预期寿命：<span class="tnum text-ink">{lifespan}</span> 岁
      </span>
      <input type="range" min="50" max="120" bind:value={lifespan} class="accent-[var(--accent)]" />
      <div class="flex justify-between text-[11px] text-faint">
        <span>50</span>
        <span>约 <span class="tnum">{Math.round(lifespan * 365.25).toLocaleString()}</span> 天</span
        >
        <span>120</span>
      </div>
    </label>
  </div>

  <button
    onclick={() => onComplete({ birthdate, lifespanYears: lifespan, version: 1 })}
    class="rounded-xl bg-accent px-10 py-3 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-strong"
  >
    开始这一生
  </button>
</div>
