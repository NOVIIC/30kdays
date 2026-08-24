/**
 * 人生配置状态：当前生效的 LifeConfig。
 * 启动时由 stores/storage 的 boot() 从存储层载入；Onboarding 提交后写入。
 */

import { writable } from 'svelte/store'
import type { LifeConfig } from '../core/domain'

/** 当前人生配置；null 表示尚未完成 Onboarding。 */
export const config = writable<LifeConfig | null>(null)
