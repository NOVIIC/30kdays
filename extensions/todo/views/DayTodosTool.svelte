<script lang="ts">
  /**
   * todo 的日记弹层工具（dayEditorTools 贡献）：展示与当天相关的待办
   * （截止日 = 当天 / 区间覆盖当天，见 todos.todosForDate），行内可勾选完成；
   * 仅当天且区间未打卡时提供「打卡」（不补卡、不撤销，与主视图同规则）。
   * 数据读写全部经 Host API（context.fs），与主视图共享 store（loadTodos 幂等）。
   */
  import { onMount } from 'svelte'
  import { localISODate } from '../../../src/core/domain/life'
  import type { DayEditorToolProps } from '../../../src/core/host'
  import { scheduleLabel, todosForDate, type Todo } from '../src/todos'
  import { checkInToday, loadTodos, saveErrors, todos, toggleDone } from '../src/store'

  // dayIndex 对本工具无用（todo 全部按日期寻址），不解构
  let { context, date }: DayEditorToolProps = $props()

  /** 「今天」（本地日历日），组件存活期内固定。 */
  const today = localISODate(new Date())
  const isToday = $derived(date === today)

  /** 与当天相关的待办；null 表示尚未载入。 */
  const relevant = $derived($todos === null ? null : todosForDate($todos, date))

  /** 进行中的区间（覆盖今天、未完成、今天未打卡）显示打卡入口。 */
  function canCheckIn(todo: Todo): boolean {
    const s = todo.schedule
    return (
      isToday &&
      s.kind === 'range' &&
      !todo.done &&
      s.start <= today &&
      today <= s.end &&
      !todo.checkIns.includes(today)
    )
  }

  onMount(() => {
    void loadTodos(context)
  })
</script>

{#if relevant === null}
  <p class="text-xs text-faint">载入中…</p>
{:else if relevant.length === 0}
  <p class="text-xs text-faint">当天没有相关待办。</p>
{:else}
  <ul class="flex flex-col gap-1.5">
    {#each relevant as todo (todo.id)}
      <li class="flex items-center gap-2.5">
        <button
          onclick={() => void toggleDone(context, todo.id)}
          aria-label={todo.done ? '标记为未完成' : '标记为完成'}
          class={[
            'flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-md border transition-colors',
            todo.done
              ? 'border-accent bg-accent text-accent-contrast'
              : 'border-line hover:border-accent',
          ]}
        >
          {#if todo.done}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              class="h-2.5 w-2.5"
            >
              <path d="M5 13l4 4 10-10" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          {/if}
        </button>
        <span
          class={[
            'min-w-0 flex-1 truncate text-sm',
            todo.done ? 'text-faint line-through' : 'text-ink',
          ]}
        >
          {todo.text === '' ? '（无内容）' : todo.text}
        </span>
        <span class="tnum shrink-0 text-xs text-faint">{scheduleLabel(todo)}</span>
        {#if canCheckIn(todo)}
          <button
            onclick={() => void checkInToday(context, todo.id)}
            class="shrink-0 rounded-lg bg-accent-soft px-2 py-1 text-xs text-accent transition-colors hover:text-accent-strong"
          >
            打卡
          </button>
        {:else if todo.schedule.kind === 'range' && todo.checkIns.includes(date)}
          <span class="shrink-0 text-xs text-faint">当日已打卡</span>
        {/if}
        {#if $saveErrors.has(todo.id)}
          <span class="shrink-0 text-xs text-accent">保存失败，将重试</span>
        {/if}
      </li>
    {/each}
  </ul>
{/if}
