//! 30kdays 桌面壳入口：注册存储命令、窗口状态插件与日志插件，构建并运行 Tauri 应用。

mod storage;

use tauri::{AppHandle, Manager};
use tauri_plugin_window_state::StateFlags;

/// 显示主窗口：前端首个绘制完成后调用（窗口以 visible:false 创建，消除 webview 白闪）。
#[tauri::command]
fn show_main_window(app: AppHandle) -> Result<(), String> {
  app
    .get_webview_window("main")
    .ok_or_else(|| "主窗口不存在".to_string())?
    .show()
    .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // 窗口状态持久化：记住尺寸/位置/最大化等，排除 VISIBLE——显示时机由前端 show_main_window 控制
    .plugin(
      tauri_plugin_window_state::Builder::new()
        .with_state_flags(StateFlags::all() - StateFlags::VISIBLE)
        .build(),
    )
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      show_main_window,
      storage::storage_read_config,
      storage::storage_write_config,
      storage::storage_read_index,
      storage::storage_write_index,
      storage::storage_read_day_doc,
      storage::storage_write_day_doc,
      storage::storage_put_media,
      storage::storage_get_media,
      storage::storage_delete_media,
      storage::storage_read_file,
      storage::storage_write_file,
      storage::storage_list_dir,
      storage::storage_remove_entry,
      storage::storage_estimate_usage,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
