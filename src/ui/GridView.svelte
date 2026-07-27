<script lang="ts">
  import { onMount } from 'svelte'
  import { createGridCanvas, type GridCanvasController } from '../grid/gridCanvas'

  let {
    totalDays,
    todayIndex,
    getDayFlags,
    onCellClick,
  }: {
    totalDays: number
    todayIndex: number
    getDayFlags: (index: number) => number
    onCellClick: (index: number) => void
  } = $props()

  let canvasEl = $state<HTMLCanvasElement | null>(null)
  let controller: GridCanvasController | null = null

  onMount(() => {
    if (!canvasEl) return
    controller = createGridCanvas({
      canvas: canvasEl,
      totalDays,
      todayIndex,
      getDayFlags,
      onCellClick,
    })
    return () => {
      controller?.destroy()
    }
  })
</script>

<canvas
  bind:this={canvasEl}
  class="absolute inset-0 h-full w-full touch-none"
></canvas>
