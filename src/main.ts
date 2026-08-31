/**
 * 应用启动入口：挂载根组件。
 * Tauri 桌面壳下窗口以 visible:false 创建，此处等首个绘制完成后显示主窗口（消除 webview 白闪）。
 */
import { mount } from 'svelte'
import './app.css'
import { invoke } from '@tauri-apps/api/core'
import { isTauri } from './core/storage'
import App from './ui/App.svelte'

const app = mount(App, {
  target: document.getElementById('app')!,
})

// 等两帧确保首绘完成再显示窗口；浏览器壳无此调用
if (isTauri()) {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      void invoke('show_main_window')
    }),
  )
}

export default app
