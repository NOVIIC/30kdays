<script lang="ts">
  import type { LifeConfig } from '../domain/lifeConfig'

  let {
    onComplete = (_cfg: LifeConfig) => {},
  }: { onComplete?: (cfg: LifeConfig) => void } = $props()

  let birthdate = $state('2000-01-01')
  let lifespan = $state(80)
</script>

<div class="flex h-dvh flex-col items-center justify-center gap-8 px-6">
  <div class="text-center">
    <h1 class="text-3xl font-light text-white">人生日历</h1>
    <p class="mt-2 text-sm text-gray-400">把一生按天铺成网格</p>
  </div>

  <div class="flex w-full max-w-xs flex-col gap-6">
    <label class="flex flex-col gap-2">
      <span class="text-sm text-gray-300">出生日期</span>
      <input
        type="date"
        bind:value={birthdate}
        class="rounded-lg border border-gray-600 bg-gray-800 px-4 py-3 text-white focus:border-indigo-500 focus:outline-none"
      />
    </label>

    <label class="flex flex-col gap-2">
      <span class="text-sm text-gray-300">预期寿命：{lifespan} 岁</span>
      <input
        type="range"
        min="50"
        max="120"
        bind:value={lifespan}
        class="accent-indigo-500"
      />
      <div class="flex justify-between text-xs text-gray-500">
        <span>50</span>
        <span>120</span>
      </div>
    </label>

    <p class="text-center text-xs text-gray-500">
      约 {Math.round(lifespan * 365.25).toLocaleString()} 天
    </p>
  </div>

  <button
    onclick={() =>
      onComplete({ birthdate, lifespanYears: lifespan, version: 1 })}
    class="rounded-lg bg-indigo-600 px-8 py-3 text-white transition-colors hover:bg-indigo-500 active:bg-indigo-700"
  >
    开始
  </button>
</div>
