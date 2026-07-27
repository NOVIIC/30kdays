<script lang="ts">
  import { onMount } from 'svelte'
  import { createGridCanvas, type GridCanvasController } from '../grid/gridCanvas'
  import { lightGridColors, type GridColors } from '../grid/palette'

  let {
    totalDays,
    todayIndex,
    getDayFlags,
    onCellClick,
    colors = lightGridColors,
  }: {
    totalDays: number
    todayIndex: number
    getDayFlags: (index: number) => number
    onCellClick: (index: number) => void
    colors?: GridColors
  } = $props()

  let canvasEl = $state<HTMLCanvasElement | null>(null)
  let controller: GridCanvasController | null = null

  export function refresh() {
    controller?.markDirty()
  }

  export function resetView() {
    controller?.resetView()
  }

  $effect(() => {
    controller?.setColors(colors)
  })

  onMount(() => {
    if (!canvasEl) return
    controller = createGridCanvas({
      canvas: canvasEl,
      totalDays,
      todayIndex,
      getDayFlags,
      onCellClick,
      colors,
    })
    return () => {
      controller?.destroy()
      controller = null
    }
  })
</script>

<canvas bind:this={canvasEl} class="absolute inset-0 h-full w-full touch-none"></canvas>
