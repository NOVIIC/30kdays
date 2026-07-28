use serde::{Deserialize, Serialize};
use serde_wasm_bindgen::{from_value, to_value};
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::JsFuture;

/// 与 src/domain/memo.ts 的 Memo 对齐（id/text/updatedAt）。
#[derive(Serialize, Deserialize, Clone)]
pub struct Memo {
    pub id: String,
    pub text: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: f64,
}

#[wasm_bindgen]
extern "C" {
    fn host_doc_read(name: String) -> js_sys::Promise;
    fn host_doc_write(name: String, data: JsValue) -> js_sys::Promise;
    fn host_uuid() -> String;
}

fn err_to_js(e: serde_wasm_bindgen::Error) -> JsValue {
    JsValue::from_str(&format!("serde: {e}"))
}

async fn load_memos() -> Result<Vec<Memo>, JsValue> {
    let promise = host_doc_read("memos.json".into());
    let value = JsFuture::from(promise).await?;
    if value.is_null() || value.is_undefined() {
        Ok(vec![])
    } else {
        Ok(from_value(value).map_err(err_to_js)?)
    }
}

async fn save_memos(memos: &[Memo]) -> Result<(), JsValue> {
    let data = to_value(memos).map_err(err_to_js)?;
    let promise = host_doc_write("memos.json".into(), data);
    JsFuture::from(promise).await?;
    Ok(())
}

/// 列表，按 updatedAt 倒序（与现有 MemoView 行为一致）
#[wasm_bindgen]
pub async fn list_memos() -> Result<JsValue, JsValue> {
    let mut memos = load_memos().await?;
    memos.sort_by(|a, b| {
        b.updated_at
            .partial_cmp(&a.updated_at)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    to_value(&memos).map_err(err_to_js)
}

/// 新建（置顶），返回新 Memo
#[wasm_bindgen]
pub async fn create_memo(text: String) -> Result<JsValue, JsValue> {
    let mut memos = load_memos().await?;
    let memo = Memo {
        id: host_uuid(),
        text,
        updated_at: js_sys::Date::now(),
    };
    let result = to_value(&memo).map_err(err_to_js)?;
    memos.insert(0, memo);
    save_memos(&memos).await?;
    Ok(result)
}

/// 按 id 更新文本（更新 updatedAt）
#[wasm_bindgen]
pub async fn update_memo(id: String, text: String) -> Result<(), JsValue> {
    let mut memos = load_memos().await?;
    let now = js_sys::Date::now();
    for m in memos.iter_mut() {
        if m.id == id {
            m.text = text;
            m.updated_at = now;
            break;
        }
    }
    save_memos(&memos).await
}

/// 按 id 删除
#[wasm_bindgen]
pub async fn remove_memo(id: String) -> Result<(), JsValue> {
    let mut memos = load_memos().await?;
    memos.retain(|m| m.id != id);
    save_memos(&memos).await
}
