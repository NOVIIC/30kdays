<script lang="ts">
  import {
    createDayIndex,
    createLifeConfig,
    FLAG_MEDIA,
    FLAG_TEXT,
    setFlag,
    todayIndex,
    totalDays,
  } from '../core/domain'
  import GridView from './GridView.svelte'

  // 临时演示数据：存储层与 Onboarding 落地前，用于手动验证网格渲染
  const config = createLifeConfig('2000-01-01', 80)
  const today = todayIndex(config)
  const dayIndex = createDayIndex(totalDays(config))
  for (let i = 0; i < today; i += 97) setFlag(dayIndex, i, FLAG_TEXT, true)
  for (let i = 50; i < today; i += 211) setFlag(dayIndex, i, FLAG_MEDIA, true)
</script>

<main class="h-full">
  <GridView {config} {dayIndex} {today} />
</main>
