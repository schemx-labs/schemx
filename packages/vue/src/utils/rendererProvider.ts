/**
 * 全局渲染器注册实例
 *
 * 模块级单例，由 ES Module 保证全局唯一。
 * vant 等 UI 适配层通过 import 后调用 registerAll 注册渲染器，
 * useForm 内部自动使用此实例作为 fallback。
 *
 * @module utils/rendererProvider
 */

import {
  createRendererRegistry,
  type RendererRegistryType,
  type SchemxRendererKey,
} from "@schemx/core"

/**
 * 全局渲染器注册实例
 *
 * @example
 * ```ts
 * // UI 适配层注册渲染器
 * import { rendererRegistry } from '@schemx/vue'
 * rendererRegistry.registerAll({ input: InputRenderer, ... })
 *
 * // useForm 内部自动使用
 * // props 传入的 rendererRegistry 优先级更高
 * ```
 */
export const rendererRegistry: RendererRegistryType<SchemxRendererKey> =
  createRendererRegistry<SchemxRendererKey>("input")
