/**
 * 人生配置状态：当前生效的 LifeConfig。
 * 暂为内存态（刷新后回到 Onboarding）；存储层落地后由其在启动时载入。
 */

import { writable } from 'svelte/store'
import type { LifeConfig } from '../core/domain'

/** 当前人生配置；null 表示尚未完成 Onboarding。 */
export const config = writable<LifeConfig | null>(null)
