<script lang="ts">
  /**
   * 待办扩展主视图：按六组（未达成/今日/近 7 日/之后/无日期/已完成）分组的分组列表。
   * 每条待办一张卡片：勾选完成 + 就地编辑正文（防抖自动保存，同 memo）+ 调度标签
   * （点开内联编辑区切换 无日期/截止/区间）+ 进行中区间的「今日打卡」+ 原位二次确认删除。
   * 分组、组内排序由 todos.ts 纯函数按「今天」实时派生；数据读写全部经 Host API
   * （context.fs，todos/<id>.json 一待办一文件），见 ../src/store.ts。
   */
  import { onDestroy, onMount, tick } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import { localISODate } from '../../../src/core/domain/life'
  import type { ExtensionContext } from '../../../src/core/host'
  import {
    GROUP_LABELS,
    GROUP_ORDER,
    addDays,
    compareInGroup,
    groupOf,
    scheduleLabel,
    spanDays,
    type Todo,
    type TodoGroup,
    type TodoSchedule,
  } from '../src/todos'
  import {
    addTodo,
    blurTodo,
    changeSchedule,
    checkInToday,
    flushAll,
    loadTodos,
    removeTodo,
    saveErrors,
    todos,
    toggleDone,
    updateTodoText,
  } from '../src/store'

  let { context }: { context: ExtensionContext } = $props()

  /** 「今天」（本地日历日），组件存活期内固定；跨天需重新进入视图刷新。 */
  const today = localISODate(new Date())

  /** 分组派生：空组不显示，组内按 compareInGroup 排序。 */
  const grouped = $derived.by(() => {
    const list = $todos
    if (list === null) return null
    return GROUP_ORDER.map((g) => ({
      group: g,
      label: GROUP_LABELS[g],
      items: list.filter((t) => groupOf(t, today) === g).sort(compareInGroup(g, today)),
    })).filter((x) => x.items.length > 0)
  })

  /** 折叠的组（默认全部展开）。 */
  let collapsedGroups = new SvelteSet<TodoGroup>()

  /** 当前展开调度编辑区的待办 id。 */
  let editingScheduleId = $state<string | null>(null)

  /** 删除二次确认：当前处于待确认态的待办 id。 */
  let confirmingId = $state<string | null>(null)
  let confirmTimer: ReturnType<typeof setTimeout> | null = null

  /** 复位删除确认态（含定时器清理）。 */
  function resetConfirm(): void {
    if (confirmTimer !== null) {
      clearTimeout(confirmTimer)
      confirmTimer = null
    }
    confirmingId = null
  }

  /** 删除按钮点击：首次进入待确认态（3 秒自动复原），再次点击真删。 */
  function onDeleteClick(id: string): void {
    if (confirmingId !== id) {
      resetConfirm()
      confirmingId = id
      confirmTimer = setTimeout(resetConfirm, 3000)
      return
    }
    resetConfirm()
    void removeTodo(context, id)
  }

  /** 折叠/展开某组。 */
  function toggleGroup(g: TodoGroup): void {
    if (collapsedGroups.has(g)) collapsedGroups.delete(g)
    else collapsedGroups.add(g)
  }

  /** 新建待办并聚焦其输入框。 */
  async function onAdd(): Promise<void> {
    const id = addTodo()
    await tick()
    document.getElementById(`todo-text-${id}`)?.focus()
  }

  /** 切换调度类型；切入截止/区间时给默认值（截止今天 / 今天起 7 天全勤）。 */
  function onKindChange(todo: Todo, kind: TodoSchedule['kind']): void {
    if (todo.schedule.kind === kind) return
    let schedule: TodoSchedule
    if (kind === 'none') {
      schedule = { kind: 'none' }
    } else if (kind === 'deadline') {
      schedule = { kind: 'deadline', due: today }
    } else {
      const end = addDays(today, 6)
      schedule = { kind: 'range', start: today, end, requiredDays: spanDays(today, end) }
    }
    void changeSchedule(context, todo.id, schedule)
  }

  /** 修改截止日（空值忽略）。 */
  function onDeadlineChange(todo: Todo, due: string): void {
    if (!due || todo.schedule.kind !== 'deadline') return
    void changeSchedule(context, todo.id, { kind: 'deadline', due })
  }

  /**
   * 修改区间字段：日期越界时收拢另一端保持 start ≤ end；
   * requiredDays 夹在 [1, 区间天数]。
   */
  function onRangeChange(todo: Todo, field: 'start' | 'end' | 'requiredDays', value: string): void {
    const s = todo.schedule
    if (s.kind !== 'range') return
    if (field === 'requiredDays') {
      const n = Math.floor(Number(value))
      if (!Number.isFinite(n)) return
      const requiredDays = Math.min(Math.max(1, n), spanDays(s.start, s.end))
      if (requiredDays !== s.requiredDays) {
        void changeSchedule(context, todo.id, { ...s, requiredDays })
      }
      return
    }
    if (!value) return
    let { start, end } = s
    if (field === 'start') {
      start = value
      if (end < start) end = start
    } else {
      end = value
      if (start > end) start = end
    }
    const requiredDays = Math.min(s.requiredDays, spanDays(start, end))
    void changeSchedule(context, todo.id, { kind: 'range', start, end, requiredDays })
  }

  /** 进行中的区间（覆盖今天、未完成）显示打卡入口。 */
  function isOngoingRange(todo: Todo): boolean {
    const s = todo.schedule
    return s.kind === 'range' && !todo.done && s.start <= today && today <= s.end
  }

  onMount(() => {
    void loadTodos(context)
  })
  onDestroy(() => {
    resetConfirm()
    void flushAll(context)
  })
</script>

{#snippet kindButton(todo: Todo, kind: TodoSchedule['kind'], label: string)}
  <button
    onclick={() => onKindChange(todo, kind)}
    class={[
      'rounded-lg px-2.5 py-1 text-xs transition-colors',
      todo.schedule.kind === kind
        ? 'bg-accent-soft text-accent'
        : 'text-soft hover:bg-sunken hover:text-ink',
    ]}
  >
    {label}
  </button>
{/snippet}

{#snippet scheduleEditor(todo: Todo)}
  <div class="mt-2 rounded-lg border border-line bg-bg p-3">
    <div class="flex gap-1.5">
      {@render kindButton(todo, 'none', '无日期')}
      {@render kindButton(todo, 'deadline', '截止')}
      {@render kindButton(todo, 'range', '区间打卡')}
    </div>
    {#if todo.schedule.kind === 'deadline'}
      <label class="mt-3 flex items-center gap-2 text-xs text-soft">
        截止日
        <input
          type="date"
          value={todo.schedule.due}
          onchange={(e) => onDeadlineChange(todo, e.currentTarget.value)}
          class="tnum rounded-lg border border-line bg-raised px-2 py-1 text-xs text-ink outline-none focus:border-accent"
        />
      </label>
    {:else if todo.schedule.kind === 'range'}
      <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-soft">
        <label class="flex items-center gap-2">
          开始
          <input
            type="date"
            value={todo.schedule.start}
            onchange={(e) => onRangeChange(todo, 'start', e.currentTarget.value)}
            class="tnum rounded-lg border border-line bg-raised px-2 py-1 text-xs text-ink outline-none focus:border-accent"
          />
        </label>
        <label class="flex items-center gap-2">
          结束
          <input
            type="date"
            value={todo.schedule.end}
            onchange={(e) => onRangeChange(todo, 'end', e.currentTarget.value)}
            class="tnum rounded-lg border border-line bg-raised px-2 py-1 text-xs text-ink outline-none focus:border-accent"
          />
        </label>
        <label class="flex items-center gap-2">
          打卡天数
          <input
            type="number"
            min="1"
            max={spanDays(todo.schedule.start, todo.schedule.end)}
            value={todo.schedule.requiredDays}
            onchange={(e) => onRangeChange(todo, 'requiredDays', e.currentTarget.value)}
            class="tnum w-16 rounded-lg border border-line bg-raised px-2 py-1 text-xs text-ink outline-none focus:border-accent"
          />
        </label>
      </div>
    {/if}
  </div>
{/snippet}

{#snippet todoCard(todo: Todo)}
  <li
    class="group rounded-xl border border-line bg-raised px-4 py-3"
    onpointerleave={() => {
      if (confirmingId === todo.id) resetConfirm()
    }}
  >
    <div class="flex items-center gap-3">
      <button
        onclick={() => void toggleDone(context, todo.id)}
        aria-label={todo.done ? '标记为未完成' : '标记为完成'}
        class={[
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
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
            class="h-3 w-3"
          >
            <path d="M5 13l4 4 10-10" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        {/if}
      </button>
      <input
        id="todo-text-{todo.id}"
        type="text"
        class={[
          'min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint',
          todo.done ? 'text-faint line-through' : 'text-ink',
        ]}
        placeholder="要做点什么……"
        value={todo.text}
        oninput={(e) => updateTodoText(context, todo.id, e.currentTarget.value)}
        onblur={() => void blurTodo(context, todo.id)}
      />
      <button
        onclick={() => onDeleteClick(todo.id)}
        class={[
          'shrink-0 rounded-lg px-2 py-1 text-xs transition-colors',
          confirmingId === todo.id
            ? 'text-accent'
            : 'text-faint hover:bg-bg hover:text-soft md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100',
        ]}
      >
        {confirmingId === todo.id ? '确认删除？' : '删除'}
      </button>
    </div>
    <div class="mt-2 flex items-center gap-2 pl-8">
      <button
        onclick={() => {
          editingScheduleId = editingScheduleId === todo.id ? null : todo.id
        }}
        class={[
          'tnum rounded-lg px-2 py-1 text-xs transition-colors',
          editingScheduleId === todo.id
            ? 'bg-accent-soft text-accent'
            : 'text-faint hover:bg-bg hover:text-soft',
        ]}
      >
        {scheduleLabel(todo)}
      </button>
      {#if isOngoingRange(todo)}
        {@const checkedToday = todo.checkIns.includes(today)}
        <button
          onclick={() => void checkInToday(context, todo.id)}
          disabled={checkedToday}
          class={[
            'rounded-lg px-2 py-1 text-xs transition-colors',
            checkedToday ? 'text-faint' : 'bg-accent-soft text-accent hover:text-accent-strong',
          ]}
        >
          {checkedToday ? '今日已打卡' : '今日打卡'}
        </button>
      {/if}
      {#if $saveErrors.has(todo.id)}
        <span class="text-xs text-accent">保存失败，将重试</span>
      {/if}
    </div>
    {#if editingScheduleId === todo.id}
      <div class="pl-8">
        {@render scheduleEditor(todo)}
      </div>
    {/if}
  </li>
{/snippet}

<div class="h-full overflow-y-auto">
  <div class="mx-auto max-w-2xl px-5 pb-28 pt-8 md:pb-12">
    <header class="mb-6 flex items-center justify-between">
      <h1 class="text-lg font-medium">待办</h1>
      <button
        onclick={() => void onAdd()}
        class="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-strong"
      >
        新建待办
      </button>
    </header>

    {#if grouped === null}
      <p class="py-16 text-center text-sm text-faint">载入中…</p>
    {:else if grouped.length === 0}
      <p class="py-16 text-center text-sm text-faint">还没有待办，点「新建待办」加一条。</p>
    {:else}
      <div class="flex flex-col gap-6">
        {#each grouped as g (g.group)}
          <section>
            <button
              onclick={() => toggleGroup(g.group)}
              class="mb-2 flex items-center gap-1.5 text-xs font-medium text-soft transition-colors hover:text-ink"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                class={[
                  'h-3 w-3 transition-transform',
                  collapsedGroups.has(g.group) ? '-rotate-90' : '',
                ]}
              >
                <path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              {g.label}
              <span class="tnum text-faint">{g.items.length}</span>
            </button>
            {#if !collapsedGroups.has(g.group)}
              <ul class="flex flex-col gap-2">
                {#each g.items as todo (todo.id)}
                  {@render todoCard(todo)}
                {/each}
              </ul>
            {/if}
          </section>
        {/each}
      </div>
    {/if}
  </div>
</div>
