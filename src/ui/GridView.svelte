<script lang="ts">
  /**
   * 网格视图：Canvas 网格 + 指针交互。
   * 滚轮缩放（绕光标）、拖拽平移、点击选中格子；
   * ResizeObserver 回流时重算布局并重新贴合视口。
   * 配色经 colors 属性注入，主题切换时热更新。
   */
  import { onMount } from 'svelte'
  import { totalDays, type LifeConfig } from '../core/domain'
  import {
    cellOrigin,
    computeLayout,
    fitCamera,
    hitTest,
    panBy,
    zoomAt,
    GridRenderer,
    type Camera,
    type GridColors,
    type GridLayout,
  } from '../core/grid'

  let {
    config,
    dayIndex,
    today,
    colors,
    ondayclick,
  }: {
    config: LifeConfig
    dayIndex: Uint8Array
    today: number
    colors: GridColors
    /** 点击某个格子（未拖动）时回调，参数为日索引。 */
    ondayclick?: (day: number) => void
  } = $props()

  let canvas: HTMLCanvasElement
  let renderer: GridRenderer | null = null
  let layout: GridLayout | null = null
  let camera: Camera | null = null
  // 配置变化时组件经 #key 重建，此处只在挂载时计算一次
  const total = $derived(totalDays(config))

  /** 应用新相机并重绘。 */
  function applyCamera(c: Camera): void {
    camera = c
    renderer?.setCamera(c)
    renderer?.render()
  }

  /** 重算布局并贴合视口（首次与窗口尺寸变化时）。 */
  function resize(): void {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (w === 0 || h === 0 || !renderer) return
    renderer.resize(w, h)
    layout = computeLayout(total, w, h)
    renderer.setData(layout, dayIndex, today)
    applyCamera(fitCamera(layout, w, h))
  }

  /** 回到全景（整网贴合视口）。 */
  export function resetView(): void {
    if (!layout) return
    applyCamera(fitCamera(layout, canvas.clientWidth, canvas.clientHeight))
  }

  /** 选中某天并把它平移到视口中心。 */
  export function goToDay(index: number): void {
    if (!layout || !camera || !renderer) return
    if (index < 0 || index >= total) return
    const origin = cellOrigin(layout, index)
    const s = camera.scale * layout.cell
    renderer.setSelected(index)
    applyCamera({
      scale: camera.scale,
      x: canvas.clientWidth / 2 - (origin.x * camera.scale + s / 2),
      y: canvas.clientHeight / 2 - (origin.y * camera.scale + s / 2),
    })
  }

  onMount(() => {
    renderer = new GridRenderer(canvas, colors)

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
      if (!dragging || !camera) return
      const dx = e.offsetX - lastX
      const dy = e.offsetY - lastY
      lastX = e.offsetX
      lastY = e.offsetY
      if (Math.abs(e.offsetX - downX) + Math.abs(e.offsetY - downY) > 4) moved = true
      if (moved) applyCamera(panBy(camera, dx, dy))
    }

    function onPointerUp(e: PointerEvent) {
      dragging = false
      if (moved || !layout || !camera || !renderer) return
      // 视为点击：命中检测、选中并回调（打开日记）
      const hit = hitTest(layout, camera, { x: e.offsetX, y: e.offsetY })
      renderer.setSelected(hit)
      renderer.render()
      if (hit !== null) ondayclick?.(hit)
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      if (!camera) return
      applyCamera(zoomAt(camera, { x: e.offsetX, y: e.offsetY }, Math.exp(-e.deltaY * 0.0015)))
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
      renderer?.destroy()
      renderer = null
    }
  })

  // 主题切换 → 热更新配色
  $effect(() => {
    renderer?.setColors(colors)
    renderer?.render()
  })

  // 日索引 / today 变化（如日记保存后标志位更新）→ 重设数据并重绘
  $effect(() => {
    if (!renderer || !layout) return
    renderer.setData(layout, dayIndex, today)
    renderer.render()
  })
</script>

<div class="h-full w-full overflow-hidden">
  <canvas bind:this={canvas} class="block h-full w-full" style="touch-action: none"></canvas>
</div>
