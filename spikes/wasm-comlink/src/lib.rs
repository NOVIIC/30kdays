use wasm_bindgen::prelude::*;

// 1) 纯同步：验证 Comlink → wasm 基本链路
#[wasm_bindgen]
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

// 2) 宿主注入的能力（extern "C"）：wasm-bindgen 默认从 globalThis 查找
#[wasm_bindgen]
extern "C" {
    fn host_doc_read(name: String) -> js_sys::Promise;
}

// 3) 异步：验证 wasm → host import (async) → Promise 回流
#[wasm_bindgen]
pub async fn read_doc_via_host(name: String) -> Result<JsValue, JsValue> {
    let promise = host_doc_read(name);
    let value = wasm_bindgen_futures::JsFuture::from(promise).await?;
    Ok(value)
}
