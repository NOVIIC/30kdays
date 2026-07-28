import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test, expect } from 'vitest'
import init, { add, read_doc_via_host } from '../spikes/wasm-comlink/pkg/spike_wasm_comlink.js'

const wasmPath = fileURLToPath(
  new URL('../spikes/wasm-comlink/pkg/spike_wasm_comlink_bg.wasm', import.meta.url),
)
const wasmBytes = readFileSync(wasmPath)

;(globalThis as Record<string, unknown>).fetch = async (input: unknown) => {
  const url = String(input)
  if (!url.endsWith('.wasm')) throw new Error('unexpected fetch: ' + url)
  return new Response(wasmBytes, {
    headers: { 'content-type': 'application/wasm' },
  })
}

;(globalThis as Record<string, unknown>).host_doc_read = (name: string) =>
  Promise.resolve({ mockData: true, name })

test('spike: wasm + host imports 链路', async () => {
  await init()
  expect(add(2, 3)).toBe(5)
  const doc = await read_doc_via_host('memos.json')
  expect(doc).toEqual({ mockData: true, name: 'memos.json' })
})
