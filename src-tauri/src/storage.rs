//! 桌面本地目录存储：前端 `StorageBackend`（src/core/storage/backend.ts）各方法对应的 Tauri 命令。
//!
//! 数据根目录为应用数据目录（Windows：`%APPDATA%/<identifier>`），文件布局与 OPFS 侧一致：
//! config.json / index.bin / days/<n>.json / media/<n>/<id>.webp|.thumb / ext/<id>/…。
//!
//! IPC 约定：
//! - JSON 文档（config / DayDoc）以前端序列化好的字符串直通，Rust 不理解其内部结构；
//! - 二进制读取经原始字节返回（`ipc::Response`）；文件不存在时返回空字节流，
//!   前端按「长度为 0 即不存在」判定（index.bin 恒含格式版本头，不会误伤）；
//! - 二进制写入中 index.bin 以原始字节为整个 invoke 载荷（application/octet-stream），
//!   其余（通用文件、媒体）经 JSON 数值数组——媒体功能尚未落地，量大后可改原始载荷优化；
//! - 所有写入均为原子写（先写同目录 `<name>.tmp` 再 rename 覆盖），避免中途崩溃留下半截文件。

use std::{
  fs,
  io::ErrorKind,
  path::{Path, PathBuf},
};

use serde::Serialize;
use tauri::{
  ipc::{InvokeBody, Request, Response},
  AppHandle, Manager,
};

/// 目录清单：子目录名与文件名列表（对应前端 `DirListing`）。
#[derive(Serialize)]
pub struct DirListing {
  dirs: Vec<String>,
  files: Vec<String>,
}

/// 存储用量估计（对应前端 `StorageUsage`）。
#[derive(Serialize)]
pub struct StorageUsage {
  usage: u64,
  quota: u64,
}

/// 数据根目录：应用数据目录，不存在则创建。
fn data_root(app: &AppHandle) -> Result<PathBuf, String> {
  let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
  fs::create_dir_all(&dir).map_err(|e| format!("创建数据目录失败 {}：{e}", dir.display()))?;
  Ok(dir)
}

/// 校验单个路径段：拒绝空段、`.`、`..` 与分隔符（防御性校验，扩展路径的常规校验在 Extension Host）。
fn check_segment(seg: &str) -> Result<(), String> {
  if seg.is_empty() || seg == "." || seg == ".." || seg.contains(['/', '\\']) {
    return Err(format!("非法路径段：{seg:?}"));
  }
  Ok(())
}

/// 将段数组解析为数据根目录下的绝对路径（如 `['ext', 'memo', 'memos.json']`）。
fn resolve(root: &Path, segments: &[String]) -> Result<PathBuf, String> {
  let mut path = root.to_path_buf();
  for seg in segments {
    check_segment(seg)?;
    path.push(seg);
  }
  Ok(path)
}

/// 第 day 天的日记文档路径（days/<day>.json）。
fn day_doc_path(root: &Path, day: u32) -> PathBuf {
  root.join("days").join(format!("{day}.json"))
}

/// 第 day 天的媒体目录路径（media/<day>/）。
fn media_dir(root: &Path, day: u32) -> PathBuf {
  root.join("media").join(day.to_string())
}

/// 同目录临时文件路径（`<name>.tmp`），供原子写使用。
fn tmp_path(path: &Path) -> PathBuf {
  let name = path
    .file_name()
    .map(|n| n.to_string_lossy().into_owned())
    .unwrap_or_default();
  path.with_file_name(format!("{name}.tmp"))
}

/// 原子写：先写同目录 .tmp 再 rename 覆盖目标；缺失的父目录逐级创建。
fn write_atomic(path: &Path, data: &[u8]) -> Result<(), String> {
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent).map_err(|e| format!("创建目录失败 {}：{e}", parent.display()))?;
  }
  let tmp = tmp_path(path);
  fs::write(&tmp, data).map_err(|e| format!("写临时文件失败 {}：{e}", tmp.display()))?;
  fs::rename(&tmp, path).map_err(|e| format!("替换目标文件失败 {}：{e}", path.display()))
}

/// 读文件字节；不存在返回空字节流（前端约定为「不存在」）。
fn read_bytes(path: &Path) -> Result<Response, String> {
  match fs::read(path) {
    Ok(data) => Ok(Response::new(data)),
    Err(e) if e.kind() == ErrorKind::NotFound => Ok(Response::new(Vec::new())),
    Err(e) => Err(format!("读取文件失败 {}：{e}", path.display())),
  }
}

/// 读文本文件；不存在返回 None。
fn read_text(path: &Path) -> Result<Option<String>, String> {
  match fs::read_to_string(path) {
    Ok(text) => Ok(Some(text)),
    Err(e) if e.kind() == ErrorKind::NotFound => Ok(None),
    Err(e) => Err(format!("读取文件失败 {}：{e}", path.display())),
  }
}

/// 删除单个文件；不存在视为成功。
fn remove_file_if_exists(path: &Path) -> Result<(), String> {
  fs::remove_file(path).or_else(|e| {
    if e.kind() == ErrorKind::NotFound {
      Ok(())
    } else {
      Err(format!("删除文件失败 {}：{e}", path.display()))
    }
  })
}

/// 读取人生配置（config.json）；未初始化返回 None。JSON 字符串直通。
#[tauri::command]
pub fn storage_read_config(app: AppHandle) -> Result<Option<String>, String> {
  read_text(&data_root(&app)?.join("config.json"))
}

/// 写入人生配置（config.json）。JSON 字符串直通，原子写。
#[tauri::command]
pub fn storage_write_config(app: AppHandle, json: String) -> Result<(), String> {
  write_atomic(&data_root(&app)?.join("config.json"), json.as_bytes())
}

/// 读取 index.bin 原始字节（含格式版本头）；不存在返回空字节流。
#[tauri::command]
pub fn storage_read_index(app: AppHandle) -> Result<Response, String> {
  read_bytes(&data_root(&app)?.join("index.bin"))
}

/// 写入 index.bin：前端以原始字节为整个 invoke 载荷，原子写。
#[tauri::command]
pub fn storage_write_index(app: AppHandle, request: Request) -> Result<(), String> {
  let InvokeBody::Raw(bytes) = request.body() else {
    return Err("storage_write_index 需要原始字节载荷".into());
  };
  write_atomic(&data_root(&app)?.join("index.bin"), bytes)
}

/// 读取第 day 天的日记文档（days/<day>.json）；不存在返回 None。JSON 字符串直通。
#[tauri::command]
pub fn storage_read_day_doc(app: AppHandle, day: u32) -> Result<Option<String>, String> {
  read_text(&day_doc_path(&data_root(&app)?, day))
}

/// 写入第 day 天的日记文档（days/<day>.json）。JSON 字符串直通，原子写。
#[tauri::command]
pub fn storage_write_day_doc(app: AppHandle, day: u32, json: String) -> Result<(), String> {
  write_atomic(&day_doc_path(&data_root(&app)?, day), json.as_bytes())
}

/// 写入某天的媒体附件：完整图 media/<day>/<id>.webp 与缩略图 .thumb（各一次原子写）。
#[tauri::command]
pub fn storage_put_media(
  app: AppHandle,
  day: u32,
  id: String,
  full: Vec<u8>,
  thumb: Vec<u8>,
) -> Result<(), String> {
  check_segment(&id)?;
  let dir = media_dir(&data_root(&app)?, day);
  write_atomic(&dir.join(format!("{id}.webp")), &full)?;
  write_atomic(&dir.join(format!("{id}.thumb")), &thumb)
}

/// 读取某天的媒体附件（kind: "full" → .webp / "thumb" → .thumb）；不存在返回空字节流。
#[tauri::command]
pub fn storage_get_media(
  app: AppHandle,
  day: u32,
  id: String,
  kind: String,
) -> Result<Response, String> {
  check_segment(&id)?;
  let ext = match kind.as_str() {
    "full" => "webp",
    "thumb" => "thumb",
    _ => return Err(format!("未知媒体档位：{kind:?}")),
  };
  read_bytes(&media_dir(&data_root(&app)?, day).join(format!("{id}.{ext}")))
}

/// 删除某天的媒体附件（完整图与缩略图一并删除）；不存在视为成功。
#[tauri::command]
pub fn storage_delete_media(app: AppHandle, day: u32, id: String) -> Result<(), String> {
  check_segment(&id)?;
  let dir = media_dir(&data_root(&app)?, day);
  remove_file_if_exists(&dir.join(format!("{id}.webp")))?;
  remove_file_if_exists(&dir.join(format!("{id}.thumb")))
}

/// 读取文件字节（段数组路径，主要供扩展文档 ext/<id>/… 使用）；不存在返回空字节流。
#[tauri::command]
pub fn storage_read_file(app: AppHandle, path: Vec<String>) -> Result<Response, String> {
  read_bytes(&resolve(&data_root(&app)?, &path)?)
}

/// 写入文件字节（段数组路径，整体覆盖）；缺失目录逐级创建，原子写。
#[tauri::command]
pub fn storage_write_file(app: AppHandle, path: Vec<String>, data: Vec<u8>) -> Result<(), String> {
  write_atomic(&resolve(&data_root(&app)?, &path)?, &data)
}

/// 列出目录内容（目录/文件分组，各自排序）；目录不存在返回 None。path 为空数组时列出根目录。
#[tauri::command]
pub fn storage_list_dir(app: AppHandle, path: Vec<String>) -> Result<Option<DirListing>, String> {
  let dir = resolve(&data_root(&app)?, &path)?;
  let entries = match fs::read_dir(&dir) {
    Ok(entries) => entries,
    Err(e) if e.kind() == ErrorKind::NotFound => return Ok(None),
    Err(e) => return Err(format!("读取目录失败 {}：{e}", dir.display())),
  };
  let mut listing = DirListing {
    dirs: Vec::new(),
    files: Vec::new(),
  };
  for entry in entries.filter_map(Result::ok) {
    let name = entry.file_name().to_string_lossy().into_owned();
    if entry.path().is_dir() {
      listing.dirs.push(name);
    } else {
      listing.files.push(name);
    }
  }
  listing.dirs.sort();
  listing.files.sort();
  Ok(Some(listing))
}

/// 删除文件或目录（段数组路径，目录递归删除）；不存在视为成功。
#[tauri::command]
pub fn storage_remove_entry(app: AppHandle, path: Vec<String>) -> Result<(), String> {
  let target = resolve(&data_root(&app)?, &path)?;
  let result = if target.is_dir() {
    fs::remove_dir_all(&target)
  } else {
    fs::remove_file(&target)
  };
  result.or_else(|e| {
    if e.kind() == ErrorKind::NotFound {
      Ok(())
    } else {
      Err(format!("删除失败 {}：{e}", target.display()))
    }
  })
}

/// 递归累加目录下文件大小；读取失败的项跳过（尽力而为的统计）。
fn dir_size(path: &Path) -> u64 {
  let Ok(entries) = fs::read_dir(path) else {
    return 0;
  };
  entries
    .filter_map(Result::ok)
    .map(|entry| {
      let path = entry.path();
      if path.is_dir() {
        dir_size(&path)
      } else {
        entry.metadata().map(|m| m.len()).unwrap_or(0)
      }
    })
    .sum()
}

/// 估计存储用量：usage 为数据目录文件总大小，quota 为 usage + 所在盘可用空间（近似可增长上限）。
/// 目录遍历在文件多（数万篇日记）时偏慢，故声明为 async 放到运行时线程执行，避免阻塞事件循环。
#[tauri::command]
pub async fn storage_estimate_usage(app: AppHandle) -> Result<StorageUsage, String> {
  let root = data_root(&app)?;
  let usage = dir_size(&root);
  let available = fs4::available_space(&root).unwrap_or(0);
  Ok(StorageUsage {
    usage,
    quota: usage + available,
  })
}

#[cfg(test)]
mod tests {
  use super::*;

  /// 合法段数组解析为根目录下的拼接路径。
  #[test]
  fn resolve_joins_segments() {
    let root = Path::new("/data");
    let path = resolve(root, &["ext".into(), "memo".into(), "memos.json".into()]).unwrap();
    assert_eq!(path, root.join("ext").join("memo").join("memos.json"));
  }

  /// 空段数组解析为根目录本身（listDir 列根目录的用法）。
  #[test]
  fn resolve_empty_is_root() {
    let root = Path::new("/data");
    assert_eq!(resolve(root, &[]).unwrap(), root);
  }

  /// 非法段（穿越、分隔符、空段）一律拒绝。
  #[test]
  fn resolve_rejects_bad_segments() {
    let root = Path::new("/data");
    for bad in ["..", ".", "", "a/b", "a\\b"] {
      assert!(resolve(root, &[bad.into()]).is_err(), "应拒绝 {bad:?}");
    }
  }

  /// 临时文件与目标同目录、以 .tmp 结尾。
  #[test]
  fn tmp_path_sits_beside_target() {
    let tmp = tmp_path(Path::new("/data/days").join("1.json").as_path());
    assert_eq!(tmp, Path::new("/data/days").join("1.json.tmp"));
  }

  /// dir_size 递归累加文件大小，不存在的目录计 0。
  #[test]
  fn dir_size_sums_recursively() {
    let dir = std::env::temp_dir().join(format!("30kdays-test-{}", std::process::id()));
    let sub = dir.join("sub");
    fs::create_dir_all(&sub).unwrap();
    fs::write(dir.join("a.bin"), [0u8; 3]).unwrap();
    fs::write(sub.join("b.bin"), [0u8; 5]).unwrap();
    assert_eq!(dir_size(&dir), 8);
    assert_eq!(dir_size(&dir.join("missing")), 0);
    fs::remove_dir_all(&dir).unwrap();
  }

  /// 原子写落盘内容正确，且临时文件不残留。
  #[test]
  fn write_atomic_leaves_no_tmp() {
    let dir = std::env::temp_dir().join(format!("30kdays-test-{}", std::process::id()));
    let target = dir.join("nested").join("config.json");
    write_atomic(&target, b"{}").unwrap();
    assert_eq!(fs::read(&target).unwrap(), b"{}");
    assert!(!tmp_path(&target).exists());
    // 覆盖写（rename 替换已存在的目标）
    write_atomic(&target, b"{\"v\":2}").unwrap();
    assert_eq!(fs::read(&target).unwrap(), b"{\"v\":2}");
    fs::remove_dir_all(&dir).unwrap();
  }
}
