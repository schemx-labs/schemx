/**
 * 全局预设规则注册实例
 *
 * 模块级单例，由 ES Module 保证全局唯一。
 * UI 适配层通过 import 后调用 register/registerAll 注册自定义规则，
 * useForm 内部自动使用此实例作为 fallback。
 *
 * @module utils/presetRuleProvider
 */

import { createPresetRuleRegistry, type PresetRuleRegistry } from "@schemx/core"

/**
 * 全局预设规则注册实例
 *
 * @example
 * ```ts
 * // 注册自定义规则
 * import { presetRuleRegistry } from '@schemx/vue'
 * presetRuleRegistry.register('phone', phoneRule)
 *
 * // useForm 内部自动使用
 * // props 传入的 presetRuleRegistry 优先级更高
 * ```
 */
export const presetRuleRegistry: PresetRuleRegistry = createPresetRuleRegistry()
