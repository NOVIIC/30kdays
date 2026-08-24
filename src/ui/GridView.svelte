<script lang="ts">
  /**
   * 网格视图：Canvas 网格 + 指针交互。
   * 滚轮缩放（绕光标）、拖拽平移、点击选中格子；
   * ResizeObserver 回流时重算布局并重新贴合视口。
   */
  import { onMount } from 'svelte'
  import { dateOf, totalDays, type LifeConfig } from '../core/domain'
  import {
    computeLayout,
    fitCamera,
    hitTest,
    panBy,
    zoomAt,
    GRID_COLORS_LIGHT,
    GridRenderer,
    type Camera,
    type GridLayout,
  } from '../core/grid'

  let { config, dayIndex, today }: { config: LifeConfig; dayIndex: Uint8Array; today: number } =
    $props()

  let canvas: HTMLCanvasElement
  let selected: number | null = $state(null)
  let selectedDate: string | null = $derived(selected === null ? null : dateOf(config, selected))

  onMount(() => {
    const renderer = new GridRenderer(canvas, GRID_COLORS_LIGHT)
    const total = totalDays(config)
    let layout: GridLayout
    let camera: Camera

    /** 重算布局并贴合视口（首次与窗口尺寸变化时）。 */
    function resize() {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (w === 0 || h === 0) return
      renderer.resize(w, h)
      layout = computeLayout(total, w, h)
      renderer.setData(layout, dayIndex, today)
      camera = fitCamera(layout, w, h)
      renderer.setCamera(camera)
      renderer.render()
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    // ---- 指针交互 ----
    let dragging = false
    let moved = false
    let lastX = 0
    let lastY = 0
    let downX = 0
    let downY = 0

    function onPointerDown(e: PointerEvent) {
      dragging = true
      moved = false
      lastX = downX = e.offsetX
      lastY = downY = e.offsetY
      canvas.setPointerCapture(e.pointerId)
    }

    function onPointerMove(e: PointerEvent) {
      if (!dragging) return
      const dx = e.offsetX - lastX
      const dy = e.offsetY - lastY
      lastX = e.offsetX
      lastY = e.offsetY
      if (Math.abs(e.offsetX - downX) + Math.abs(e.offsetY - downY) > 4) moved = true
      if (moved) {
        camera = panBy(camera, dx, dy)
        renderer.setCamera(camera)
        renderer.render()
      }
    }

    function onPointerUp(e: PointerEvent) {
      dragging = false
      if (moved) return
      // 视为点击：命中检测并选中
      const hit = hitTest(layout, camera, { x: e.offsetX, y: e.offsetY })
      selected = hit
      renderer.setSelected(hit)
      renderer.render()
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      camera = zoomAt(camera, { x: e.offsetX, y: e.offsetY }, Math.exp(-e.deltaY * 0.0015))
      renderer.setCamera(camera)
      renderer.render()
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('wheel', onWheel)
      renderer.destroy()
    }
  })
</script>

<div class="relative h-full w-full overflow-hidden">
  <canvas bind:this={canvas} class="block h-full w-full" style="touch-action: none"></canvas>
  {#if selectedDate}
    <div
      class="pointer-events-none absolute bottom-3 left-3 rounded bg-stone-800/80 px-2 py-1 text-xs text-stone-100"
    >
      {selectedDate} · 第 {selected! + 1} 天
    </div>
  {/if}
</div>
