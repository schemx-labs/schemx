/**
 * 渲染器注册中心。
 *
 * 纯粹的注册/查询中心，不负责渲染逻辑。
 *
 * @module core/registry/rendererRegistry
 *
 * @example
 * ```ts
 * import { createRendererRegistry, type RendererMap } from '@schemx/core'
 *
 * // 定义渲染器组件
 * const InputRenderer = (props) => <input {...props} />
 * const SelectRenderer = (props) => <select {...props} />
 * const TextRenderer = (props) => <span>{props.value}</span>
 *
 * // 创建注册中心，带默认渲染器
 * const registry = createRendererRegistry('text')
 *
 * // 单个注册
 * registry.register('input', InputRenderer)
 * registry.register('select', SelectRenderer)
 *
 * // 批量注册
 * const renderers: RendererMap = {
 *   text: TextRenderer,
 *   number: InputRenderer,
 *   date: InputRenderer
 * }
 * registry.registerAll(renderers)
 *
 * // 获取渲染器（纯查询，未注册返回 undefined）
 * const exact = registry.get('input')
 * const missing = registry.get('unknown') // => undefined
 *
 * // 解析渲染器（未注册时回退到默认类型）
 * const fallback = registry.resolve('unknown') // => 默认的 'text'
 *
 * // 检查是否存在
 * registry.has('input') // => true
 *
 * // 获取所有类型
 * registry.keys() // => ['input', 'select', 'text', 'number', 'date']
 *
 * // 设置回退渲染器
 * registry.setFallback('input')
 * registry.getFallback() // => 'input'
 *
 * // 取消注册
 * registry.unregister('date')
 *
 * // 清空所有
 * registry.clear()
 * ```
 *
 * @example
 * ```ts
 * // 在 createForm 中使用
 * const rendererRegistry = createRendererRegistry()
 * rendererRegistry.registerAll(customRenderers)
 *
 * const form = createForm({
 *   schemas: [...],
 *   rendererRegistry // 使用自定义渲染器注册中心
 * })
 * ```
 */

import type { SchemxRendererKey } from "../types"
import type { RegistryOptions } from "./types"

/**
 * 渲染器组件映射类型。
 *
 * key 为渲染器类型字符串，value 为对应的框架组件。
 */
export type RendererMap<T extends SchemxRendererKey, R = unknown> = Record<T, R>

/**
 * 渲染器注册中心。
 *
 * 纯粹的 Map 存储。
 *
 * @remarks
 * 当 {@link RendererRegistry.resolve} 找不到指定类型时，会回退到构造函数或
 * {@link RendererRegistry.setFallback} 设置的回退类型；未设置时不会回退。
 */
export class RendererRegistry<
  T extends SchemxRendererKey = SchemxRendererKey,
  R = unknown,
> {
  /** 渲染器存储 */
  private renderers: Map<T, R>

  /** 回退渲染器类型 */
  private fallbackType?: T

  /**
   * 创建 Registry 实例。
   *
   * @param fallbackType - 回退渲染器类型，未找到指定类型时回退使用
   */
  constructor(fallbackType?: T) {
    this.renderers = new Map()
    this.fallbackType = fallbackType
  }

  /**
   * 注册渲染器。
   *
   * 默认会覆盖已存在的同名渲染器，可通过 `options.override` 控制。
   *
   * @param type - 渲染器类型标识
   * @param renderer - 组件
   * @param options - 注册选项
   *
   * @example
   * ```typescript
   * renderer.register('text', TextRenderer)
   * renderer.register('text', NewTextRenderer, { override: true })
   * ```
   */
  register(type: T, renderer: R, options?: RegistryOptions): void {
    if (this.renderers.has(type) && options?.override === false) {
      console.warn(
        `[RendererRegistry] Renderer "${type}" already exists, skipping registration`
      )

      return
    }

    this.renderers.set(type, renderer)
  }

  /**
   * 批量注册渲染器。
   *
   * 遍历映射对象逐个注册，已存在的同名渲染器会被直接覆盖。
   *
   * @param renderers - 类型到组件的映射对象
   *
   * @example
   * ```typescript
   * renderer.registerAll({
   *   text: TextRenderer,
   *   number: NumberRenderer,
   *   date: DateRenderer,
   * })
   * ```
   */
  registerAll(renderers: RendererMap<T, R>): void {
    Object.entries(renderers).forEach(([type, renderer]) => {
      this.renderers.set(type as T, renderer as R)
    })
  }

  /**
   * 纯查询：获取指定类型的渲染器组件。
   *
   * 未找到时返回 `undefined`，不触发回退、不发出警告。
   *
   * @param type - 渲染器类型标识
   * @returns 对应的组件，未找到时返回 undefined
   *
   * @example
   * ```typescript
   * const renderer = renderer.get('text')
   * const missing = renderer.get('unknown') // => undefined
   * ```
   */
  get(type: T): R | undefined {
    return this.renderers.get(type)
  }

  /**
   * 解析渲染器：获取指定类型的渲染器组件，未找到时回退到回退类型。
   *
   * 回退类型也不存在则返回 `undefined`，并在未命中时发出警告。
   *
   * @param type - 渲染器类型标识
   * @returns 对应的组件，未找到且无回退时返回 undefined
   *
   * @example
   * ```typescript
   * const renderer = renderer.resolve('text')
   * const fallback = renderer.resolve('unknown') // => 回退渲染器
   * ```
   */
  resolve(type: T): R | undefined {
    let renderer = this.renderers.get(type)

    if (!renderer) {
      console.warn(
        `[RendererRegistry] Renderer "${type}" not found, falling back to "${this.fallbackType}"`
      )

      if (this.fallbackType) renderer = this.renderers.get(this.fallbackType)
    }

    return renderer
  }

  /**
   * 检查渲染器是否已注册
   *
   * @param type - 渲染器类型标识
   * @returns 是否存在
   *
   * @example
   * ```typescript
   * renderer.has('text')   // => true
   * renderer.has('custom') // => false
   * ```
   */
  has(type: T): boolean {
    return this.renderers.has(type)
  }

  /**
   * 移除渲染器
   *
   * 如果移除的是当前回退类型，会从剩余渲染器中智能选取新回退类型。
   * 若无剩余渲染器则清除回退类型。
   *
   * @param type - 渲染器类型标识
   * @returns 是否成功移除
   *
   * @example
   * ```typescript
   * renderer.unregister('date') // => true
   * renderer.unregister('nonexistent') // => false
   * ```
   */
  unregister(type: T): boolean {
    const isFallback = type === this.fallbackType

    const deleted = this.renderers.delete(type)

    if (isFallback && deleted) {
      const firstKey = this.renderers.keys().next().value

      if (firstKey) {
        console.warn(
          `[RendererRegistry] Fallback renderer was removed, Please reset the fallback renderer.`
        )

        this.fallbackType = firstKey
      }
    }

    return deleted
  }

  /**
   * 获取所有已注册的渲染器类型
   *
   * @returns 类型标识数组
   *
   * @example
   * ```typescript
   * renderer.keys() // => ['text', 'number', 'date']
   * ```
   */
  keys(): T[] {
    return Array.from(this.renderers.keys())
  }

  /**
   * 设置回退渲染器类型
   *
   * 当 {@link RendererRegistry.resolve} 找不到指定类型时，会回退到该类型。
   * 设置的类型必须已注册，否则操作无效。
   *
   * @param type - 渲染器类型标识
   *
   * @example
   * ```typescript
   * renderer.setFallback('number')
   * renderer.getFallback() // => 'number'
   * ```
   */
  setFallback(type: T): void {
    if (!this.renderers.has(type)) {
      console.warn(
        `[RendererRegistry] Cannot set fallback to "${type}": renderer not registered`
      )

      return
    }

    this.fallbackType = type
  }

  /**
   * 获取当前回退渲染器类型
   *
   * @returns 回退类型标识
   *
   * @example
   * ```typescript
   * renderer.getFallback() // => 'text'
   * ```
   */
  getFallback(): T | undefined {
    return this.fallbackType
  }

  /**
   * 清除所有已注册的渲染器和回退类型。
   *
   * @example
   * ```typescript
   * renderer.clear()
   * registry.size() // => 0
   * ```
   */
  clear(): void {
    this.renderers.clear()
    this.fallbackType = undefined
  }

  /**
   * 获取已注册渲染器数量
   *
   * @returns 渲染器数量
   *
   * @example
   * ```typescript
   * renderer.size() // => 5
   * ```
   */
  size(): number {
    return this.renderers.size
  }
}

/**
 * 创建独立的渲染器注册中心实例。
 *
 * @param fallbackType - 回退渲染器类型
 * @returns 新的 Registry 实例
 *
 * @remarks
 * 调用方可以通过 `fallbackType` 配置未命中时使用的回退类型。
 *
 * @example
 * ```ts
 * const registry = createRendererRegistry("input")
 * registry.register("input", InputRenderer)
 * ```
 */
export function createRendererRegistry<T extends SchemxRendererKey, R = unknown>(
  fallbackType?: T
): RendererRegistry<T, R> {
  return new RendererRegistry<T, R>(fallbackType)
}
