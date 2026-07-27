<script lang="ts">
  import {
    groupTodos,
    todoStatus,
    toggleCheckin,
    toggleDone,
    isComplete,
    todayString,
    daysBetween,
    type Todo,
    type TodoGroup,
  } from '../domain/todo'
  import { todos, addTodo, updateTodo, removeTodo } from '../stores/todos'
  import TodoEditor from './TodoEditor.svelte'

  const today = todayString()

  let editing = $state<Todo | 'new' | null>(null)
  let showDone = $state(false)

  const groups = $derived(groupTodos($todos, today))
  const activeCount = $derived($todos.filter((t) => todoStatus(t, today) === 'active').length)

  const groupLabels: Record<TodoGroup, string> = {
    failed: '未达成',
    today: '今日',
    upcoming: '近 7 日',
    later: '之后',
    nodate: '无日期',
    done: '已完成',
  }

  function formatCN(s: string): string {
    const y = parseInt(s.slice(0, 4))
    const m = parseInt(s.slice(5, 7))
    const d = parseInt(s.slice(8, 10))
    const thisYear = parseInt(today.slice(0, 4))
    return y === thisYear ? `${m}月${d}日` : `${y}年${m}月${d}日`
  }

  function metaOf(t: Todo): string {
    const s = t.schedule
    if (s.kind === 'deadline') {
      const n = daysBetween(today, s.due)
      if (n > 0) return `截止 ${formatCN(s.due)} · 剩 ${n} 天`
      if (n === 0) return `今天截止`
      return `截止 ${formatCN(s.due)} · 已过期 ${-n} 天`
    }
    if (s.kind === 'range') {
      const base = `${formatCN(s.start)} – ${formatCN(s.end)} · 打卡 ${t.checkins.length}/${s.requiredDays}`
      if (todoStatus(t, today) === 'active' && s.start <= today && today <= s.end) {
        return t.checkins.includes(today) ? `${base} · 今日已打卡` : `${base} · 今日待打卡`
      }
      return base
    }
    return ''
  }

  function handleCheck(t: Todo) {
    const status = todoStatus(t, today)
    if (status === 'failed') {
      editing = t
      return
    }
    if (status === 'done') {
      // 仅手动完成的可以取消完成；区间自动完成的需在编辑器里调整
      if (t.done) updateTodo(toggleDone(t))
      return
    }
    if (t.schedule.kind === 'range') {
      const { start, end } = t.schedule
      if (start <= today && today <= end) {
        updateTodo(toggleCheckin(t, today))
      }
      return
    }
    updateTodo(toggleDone(t))
  }

  function handleSave(t: Todo) {
    if (editing === 'new') addTodo(t)
    else updateTodo(t)
    editing = null
  }
</script>

{#snippet checkButton(t: Todo)}
  {@const status = todoStatus(t, today)}
  {@const s = t.schedule}
  {@const checkedToday = s.kind === 'range' && t.checkins.includes(today)}
  <button
    onclick={(e) => {
      e.stopPropagation()
      handleCheck(t)
    }}
    aria-label={status === 'done' ? '已完成' : '打卡/完成'}
    class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors
      {status === 'done' || (status === 'active' && checkedToday)
      ? 'border-accent bg-accent text-accent-contrast'
      : status === 'failed'
        ? 'border-danger text-danger'
        : 'border-line-strong text-transparent hover:border-accent'}"
  >
    {#if status === 'done' || (status === 'active' && checkedToday)}
      <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
        <path d="m5 13 4 4L19 7" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    {:else if status === 'failed'}
      <span class="text-[10px] font-bold leading-none">!</span>
    {/if}
  </button>
{/snippet}

<div class="h-full overflow-y-auto">
  <div class="mx-auto max-w-2xl px-5 pb-28 pt-8 md:pb-12">
    <div class="mb-6 flex items-end justify-between">
      <div>
        <h1 class="text-xl font-medium tracking-tight">待办</h1>
        <p class="mt-1 text-xs text-faint">
          {activeCount > 0 ? `${activeCount} 项进行中` : '没有进行中的事项'}
        </p>
      </div>
      <button
        onclick={() => (editing = 'new')}
        class="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-strong"
      >
        新建
      </button>
    </div>

    {#if groups.length === 0}
      <div class="mt-24 flex flex-col items-center gap-3 text-center">
        <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-sunken text-faint">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            class="h-6 w-6"
          >
            <rect x="4" y="4" width="16" height="16" rx="3" />
            <path d="m8.5 12.5 2.5 2.5 4.5-5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <p class="text-sm text-faint">还没有待办事项<br />立一个目标，从今天的一小步开始</p>
      </div>
    {/if}

    {#each groups as g (g.group)}
      <section class="mb-7">
        {#if g.group === 'done'}
          <button
            onclick={() => (showDone = !showDone)}
            class="mb-2.5 flex items-center gap-1.5 text-xs font-medium tracking-wide text-faint hover:text-soft"
          >
            <svg
              class="h-3 w-3 transition-transform {showDone ? 'rotate-90' : ''}"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path d="m9 6 6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            {groupLabels[g.group]} · {g.items.length}
          </button>
        {:else}
          <h2
            class="mb-2.5 text-xs font-medium tracking-wide
            {g.group === 'failed' ? 'text-danger' : 'text-faint'}"
          >
            {groupLabels[g.group]} · {g.items.length}
          </h2>
        {/if}

        {#if g.group !== 'done' || showDone}
          <ul class="overflow-hidden rounded-2xl border border-line bg-raised">
            {#each g.items as t, i (t.id)}
              {@const status = todoStatus(t, today)}
              {@const done = isComplete(t)}
              <li>
                <button
                  onclick={() => (editing = t)}
                  class="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-sunken
                    {i > 0 ? 'border-t border-line' : ''}"
                >
                  {@render checkButton(t)}
                  <span class="min-w-0 flex-1">
                    <span
                      class="block truncate text-sm
                      {done
                        ? 'text-faint line-through'
                        : status === 'failed'
                          ? 'text-danger'
                          : 'text-ink'}"
                    >
                      {t.title}
                    </span>
                    {#if metaOf(t)}
                      <span
                        class="mt-0.5 block text-xs {status === 'failed'
                          ? 'text-danger/70'
                          : 'text-faint'}"
                      >
                        {metaOf(t)}
                      </span>
                    {/if}
                  </span>
                  {#if status === 'failed'}
                    <span
                      class="mt-0.5 shrink-0 rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-medium text-danger"
                    >
                      未达成
                    </span>
                  {/if}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/each}
  </div>
</div>

{#if editing !== null}
  <TodoEditor
    initial={editing === 'new' ? null : editing}
    onSave={handleSave}
    onDelete={editing === 'new'
      ? null
      : (id) => {
          removeTodo(id)
          editing = null
        }}
    onClose={() => (editing = null)}
  />
{/if}
