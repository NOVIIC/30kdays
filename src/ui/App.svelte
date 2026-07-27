<script lang="ts">
  import { onMount } from 'svelte'
  import { createRouter, type View } from '../stores/router'
  import { storageService } from '../lib/storageService'
  import { config } from '../stores/config'
  import { selectedDay } from '../stores/selectedDay'
  import { todayIndex } from '../domain/lifeConfig'
  import type { LifeConfig } from '../domain/lifeConfig'
  import type { DayDoc } from '../storage/StorageBackend'
  import Onboarding from './Onboarding.svelte'
  import GridView from './GridView.svelte'
  import DayEditor from './DayEditor.svelte'
  import TopBar from './TopBar.svelte'
  import Settings from './Settings.svelte'

  const { view, params, navigate } = createRouter()

  let loading = $state(true)
  let todayIdx = $state(0)
  let showEditor = $state(false)
  let showSettings = $state(false)

  $effect(() => {
    if ($params.d) {
      const d = parseInt($params.d)
      if (!isNaN(d)) {
        selectedDay.set(d)
      }
    }
  })

  onMount(async () => {
    const cfg = await storageService.init()
    config.set(cfg)
    if (cfg) {
      todayIdx = todayIndex(cfg)
    }
    loading = false

    $effect(() => {
      // Watch for config changes from onboarding
      const c = $config
      if (c) {
        todayIdx = todayIndex(c)
      }
    })
  })

  function handleOnboardingComplete(cfg: LifeConfig) {
    storageService.saveConfig(cfg).then(() => {
      config.set(cfg)
      todayIdx = todayIndex(cfg)
      navigate('grid')
    })
  }

  function handleCellClick(idx: number) {
    selectedDay.set(idx)
    showEditor = true
  }

  function handleEditorClose() {
    showEditor = false
  }

  function handleEditorNavigate(idx: number) {
    selectedDay.set(idx)
  }

  async function handleEditorSave(idx: number, doc: DayDoc) {
    await storageService.saveDay(idx, doc)
  }

  function handleToday() {
    selectedDay.set(todayIdx)
  }

  function handleSettings() {
    showSettings = true
  }

  function handleSettingsClose() {
    showSettings = false
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
    }
  }
</script>

<main class="relative h-dvh w-screen overflow-hidden bg-[#0f1117]">
  {#if loading}
    <div class="flex h-full items-center justify-center text-gray-400">
      加载中...
    </div>
  {:else if $config === null || $view === 'onboarding'}
    <Onboarding onComplete={handleOnboardingComplete} />
  {:else}
    {#if $config}
      <TopBar onSettings={handleSettings} onToday={handleToday} />
      <GridView
        totalDays={storageService.totalDays}
        todayIndex={todayIdx}
        getDayFlags={(i) => storageService.getDayFlags(i)}
        onCellClick={handleCellClick}
      />
    {/if}

    {#if showEditor && $config && $selectedDay !== null}
      <DayEditor
        dayIndex={$selectedDay}
        config={$config}
        onClose={handleEditorClose}
        onNavigate={handleEditorNavigate}
        onSave={handleEditorSave}
        readDay={(i) => storageService.readDay(i)}
      />
    {/if}

    {#if showSettings}
      <Settings
        config={$config}
        onClose={handleSettingsClose}
        onConfigChange={handleConfigChange}
        onExport={handleExport}
        onImport={handleImport}
      />
    {/if}
  {/if}
</main>
