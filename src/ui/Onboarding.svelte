<script lang="ts">
  /**
   * Onboarding：首次使用选择生日与预期寿命，生成人生配置。
   */
  import { createLifeConfig } from '../core/domain'
  import { completeOnboarding } from '../stores/storage'

  let birthdate = $state('2000-01-01')
  let lifespan = $state(80)
  let saving = $state(false)

  /** 提交表单：写入 config.json 与空 index.bin 后进入日历（见 stores/storage）。 */
  async function submit() {
    if (saving) return
    saving = true
    await completeOnboarding(createLifeConfig(birthdate, lifespan))
  }
</script>

<div class="flex h-full flex-col items-center justify-center gap-10 px-6">
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
    <h1 class="text-2xl font-light tracking-wide">三万天</h1>
    <p class="mt-2 text-sm text-soft">每一天都铺在你眼前</p>
  </div>

  <div class="flex w-full max-w-xs flex-col gap-6">
    <label class="flex flex-col gap-2">
      <span class="text-xs font-medium text-soft">出生日期</span>
      <input
        type="date"
        bind:value={birthdate}
        class="rounded-xl border border-line bg-raised px-4 py-3 text-sm focus:border-accent focus:outline-none"
      />
    </label>

    <label class="flex flex-col gap-2">
      <span class="text-xs font-medium text-soft">
        预期寿命：<span class="tnum text-ink">{lifespan}</span> 岁
      </span>
      <input type="range" min="50" max="120" bind:value={lifespan} class="accent-(--accent)" />
      <div class="flex justify-between text-[11px] text-faint">
        <span>50</span>
        <span>约 <span class="tnum">{Math.round(lifespan * 365.25).toLocaleString()}</span> 天</span
        >
        <span>120</span>
      </div>
    </label>
  </div>

  <button
    onclick={submit}
    disabled={saving}
    class="rounded-xl bg-accent px-10 py-3 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-strong disabled:opacity-50"
  >
    {saving ? '正在初始化…' : '开始这一生'}
  </button>
</div>
