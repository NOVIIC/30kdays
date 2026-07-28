<script lang="ts">
  import { onMount } from 'svelte'
  import { createRouter } from '../stores/router'
  import { storageService } from '../lib/storageService'
  import { extensionHost } from '../extensions/host'
  import { config } from '../stores/config'
  import { todos, loadTodos } from '../stores/todos'
  import { initTheme, effectiveTheme } from '../stores/theme'
  import { todayIndex } from '../domain/lifeConfig'
  import { deadlineDayIndices, todayString } from '../domain/todo'
  import { FLAG_HAS_TODO } from '../domain/dayIndex'
  import { lightGridColors, darkGridColors } from '../grid/palette'
  import type { LifeConfig } from '../domain/lifeConfig'
  import type { DayDoc } from '../storage/StorageBackend'
  import type { Component } from 'svelte'
  import Onboarding from './Onboarding.svelte'
  import SideNav from './SideNav.svelte'
  import CalendarView from './CalendarView.svelte'
  import TodoView from './TodoView.svelte'
  import SettingsView from './SettingsView.svelte'
  import DayEditor from './DayEditor.svelte'

  const { view, navigate } = createRouter()

  let loading = $state(true)
  let todayIdx = $state(0)
  let editorDay = $state<number | null>(null)
  let calendar: CalendarView | null = $state(null)
  let items = $state<{ id: string; label: string; icon: string }[]>([
    { id: 'calendar', label: '日历', icon: 'grid' },
    { id: 'todo', label: '待办', icon: 'check' },
    { id: 'settings', label: '设置', icon: 'gear' },
  ])
  let extComp = $state<Component | null>(null)
  let extLogic = $state<unknown>(null)

  const gridColors = $derived($effectiveTheme === 'dark' ? darkGridColors : lightGridColors)
  const todoDays = $derived(
    $config ? deadlineDayIndices($todos, $config, todayString()) : new Set<number>(),
  )

  // todo 变化 → 刷新日历上的截止日标记
  $effect(() => {
    void todoDays
    calendar?.refresh()
  })

  // view 变化时动态加载扩展视图组件
  $effect(() => {
    const v = $view
    if (v === 'calendar' || v === 'todo' || v === 'settings') {
      extComp = null
      extLogic = null
      return
    }
    const info = extensionHost.registry.getViewForRoute(v)
    if (!info) {
      extComp = null
      extLogic = null
      return
    }
    extLogic = extensionHost.getLogic(info.extId) ?? null
    import(/* @vite-ignore */ `/extensions/${info.extId}/${info.component}`)
      .then((mod: { default: Component }) => {
        extComp = mod.default
      })
      .catch((e) => {
        console.error('[ext] load component', e)
        extComp = null
      })
  })

  onMount(async () => {
    initTheme()
    const cfg = await storageService.init()
    config.set(cfg)
    if (cfg) {
      todayIdx = todayIndex(cfg)
      await loadTodos()
    }
    // 扩展加载不依赖 config（onboarding 时也加载，进主视图即有扩展 tab）
    await extensionHost.loadBuiltin()
    items = [
      { id: 'calendar', label: '日历', icon: 'grid' },
      { id: 'todo', label: '待办', icon: 'check' },
      ...extensionHost.registry.getViews().map((v) => ({
        id: v.id,
        label: v.label,
        icon: v.icon,
      })),
      { id: 'settings', label: '设置', icon: 'gear' },
    ]
    loading = false
  })

  function handleOnboardingComplete(cfg: LifeConfig) {
    storageService.saveConfig(cfg).then(() => {
      config.set(cfg)
      todayIdx = todayIndex(cfg)
      navigate('calendar')
    })
  }

  function handleCellClick(idx: number) {
    editorDay = idx
  }

  function handleToday() {
    editorDay = todayIdx
  }

  function handleEditorClose() {
    editorDay = null
  }

  function handleEditorNavigate(idx: number) {
    editorDay = idx
  }

  async function handleEditorSave(idx: number, doc: DayDoc) {
    await storageService.saveDay(idx, doc)
    calendar?.refresh()
  }

  async function handleConfigChange(lifespan: number) {
    const cfg = $config
    if (!cfg) return
    const newCfg = { ...cfg, lifespanYears: lifespan, version: cfg.version }
    await storageService.saveConfig(newCfg)
    config.set(newCfg)
    todayIdx = todayIndex(newCfg)
  }

  async function handleExport() {
    const blob = await storageService.exportZip()
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `30kdays-backup-${new Date().toISOString().slice(0, 10)}.zip`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(file: File) {
    await storageService.importZip(file)
    const cfg = await storageService.init()
    config.set(cfg)
    if (cfg) {
      todayIdx = todayIndex(cfg)
      await loadTodos()
    }
    navigate('calendar')
    calendar?.refresh()
  }
</script>

<main class="h-dvh w-screen overflow-hidden bg-bg text-ink">
  {#if loading}
    <div class="flex h-full items-center justify-center text-sm text-faint">加载中…</div>
  {:else if $config === null}
    <Onboarding onComplete={handleOnboardingComplete} />
  {:else}
    <div class="flex h-full">
      <SideNav view={$view} onNavigate={navigate} {items} />
      <div class="relative min-w-0 flex-1">
        {#if $view === 'calendar'}
          <CalendarView
            bind:this={calendar}
            totalDays={storageService.totalDays}
            todayIndex={todayIdx}
            getDayFlags={(i) =>
              storageService.getDayFlags(i) | (todoDays.has(i) ? FLAG_HAS_TODO : 0)}
            onCellClick={handleCellClick}
            onToday={handleToday}
            colors={gridColors}
          />
        {:else if $view === 'todo'}
          <TodoView />
        {:else if $view === 'settings'}
          <SettingsView
            config={$config}
            onConfigChange={handleConfigChange}
            onExport={handleExport}
            onImport={handleImport}
          />
        {:else if extComp}
          {@const ExtComp = extComp}
          <ExtComp logic={extLogic} />
        {/if}
      </div>
    </div>

    {#if editorDay !== null && $config}
      <DayEditor
        dayIndex={editorDay}
        config={$config}
        onClose={handleEditorClose}
        onNavigate={handleEditorNavigate}
        onSave={handleEditorSave}
        readDay={(i) => storageService.readDay(i)}
        readMedia={(i, id) => storageService.readMedia(i, id)}
        writeMedia={(i, id, blob) => storageService.writeMedia(i, id, blob)}
        deleteMedia={(i, id) => storageService.deleteMedia(i, id)}
      />
    {/if}
  {/if}
</main>
