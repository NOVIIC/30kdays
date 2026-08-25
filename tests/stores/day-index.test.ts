import { describe, expect, it, vi } from 'vitest'
import { get } from 'svelte/store'
import { createLifeConfig, FLAG_TEXT, serializeDayIndex, totalDays } from '../../src/core/domain'
import { createOpfsStore } from '../../src/core/storage/opfs-store'
import { dayIndex, loadDayIndex, setDayFlags } from '../../src/stores/day-index'
import { createFakeOpfsRoot } from '../storage/fake-opfs'

const cfg = createLifeConfig('2000-01-01', 80)

describe('loadDayIndex', () => {
  it('index.bin 不存在时建空并写盘', async () => {
    const store = createOpfsStore(createFakeOpfsRoot())
    await loadDayIndex(store, cfg)
    const loaded = get(dayIndex)
    expect(loaded.length).toBe(totalDays(cfg))
    expect(loaded.every((b) => b === 0)).toBe(true)
    // 已写盘：再次读取能拿到序列化后的内容
    const bytes = await store.readIndex()
    expect(bytes).not.toBeNull()
    expect(bytes!.length).toBe(totalDays(cfg) + 1)
  })

  it('正常载入既有标志位', async () => {
    const store = createOpfsStore(createFakeOpfsRoot())
    const flags = new Uint8Array(totalDays(cfg))
    flags[3] = 0b01
    flags[100] = 0b11
    await store.writeIndex(serializeDayIndex(flags))
    await loadDayIndex(store, cfg)
    const loaded = get(dayIndex)
    expect(loaded[3]).toBe(0b01)
    expect(loaded[100]).toBe(0b11)
  })

  it('长度不足时补零迁移并写盘', async () => {
    const store = createOpfsStore(createFakeOpfsRoot())
    const short = new Uint8Array(10)
    short[9] = 0b01
    await store.writeIndex(serializeDayIndex(short))
    await loadDayIndex(store, cfg)
    const loaded = get(dayIndex)
    expect(loaded.length).toBe(totalDays(cfg))
    expect(loaded[9]).toBe(0b01)
    const bytes = await store.readIndex()
    expect(bytes!.length).toBe(totalDays(cfg) + 1)
  })

  it('长度超出时截断迁移', async () => {
    const store = createOpfsStore(createFakeOpfsRoot())
    const long = new Uint8Array(totalDays(cfg) + 5)
    long[totalDays(cfg) - 1] = 0b10
    long[totalDays(cfg) + 4] = 0b01 // 超出部分应被丢弃
    await store.writeIndex(serializeDayIndex(long))
    await loadDayIndex(store, cfg)
    const loaded = get(dayIndex)
    expect(loaded.length).toBe(totalDays(cfg))
    expect(loaded[totalDays(cfg) - 1]).toBe(0b10)
  })

  it('格式版本不符时按全空重建', async () => {
    const store = createOpfsStore(createFakeOpfsRoot())
    const bytes = serializeDayIndex(new Uint8Array(totalDays(cfg)).fill(0b11))
    bytes[0] = 99 // 非法版本
    await store.writeIndex(bytes)
    await loadDayIndex(store, cfg)
    const loaded = get(dayIndex)
    expect(loaded.every((b) => b === 0)).toBe(true)
  })
})

describe('setDayFlags', () => {
  it('标志位变化时更新内存并写盘', async () => {
    const store = createOpfsStore(createFakeOpfsRoot())
    dayIndex.set(new Uint8Array(5))
    await setDayFlags(store, 2, FLAG_TEXT)
    expect(get(dayIndex)[2]).toBe(FLAG_TEXT)
    const bytes = await store.readIndex()
    expect(bytes![1 + 2]).toBe(FLAG_TEXT) // 首字节为格式版本头
  })

  it('标志位无变化时不写盘', async () => {
    const store = createOpfsStore(createFakeOpfsRoot())
    dayIndex.set(new Uint8Array([0, 0, FLAG_TEXT]))
    const spy = vi.spyOn(store, 'writeIndex')
    await setDayFlags(store, 2, FLAG_TEXT)
    expect(spy).not.toHaveBeenCalled()
  })

  it('索引越界时忽略', async () => {
    const store = createOpfsStore(createFakeOpfsRoot())
    dayIndex.set(new Uint8Array(3))
    const spy = vi.spyOn(store, 'writeIndex')
    await setDayFlags(store, 3, FLAG_TEXT)
    await setDayFlags(store, -1, FLAG_TEXT)
    expect(spy).not.toHaveBeenCalled()
    expect(get(dayIndex).every((b) => b === 0)).toBe(true)
  })
})
