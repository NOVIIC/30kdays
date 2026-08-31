//! 30kdays 桌面壳入口：注册存储命令与日志插件，构建并运行 Tauri 应用。

mod storage;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
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
