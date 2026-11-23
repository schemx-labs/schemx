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
 * // 获取渲染器
 * const inputRenderer = registry.getRenderer('input')
 * const fallback = registry.getRenderer('unknown') // 返回默认的 'text'
 *
 * // 检查是否存在
 * registry.hasRenderer('input') // => true
 *
 * // 获取所有类型
 * registry.getTypes() // => ['input', 'select', 'text', 'number', 'date']
 *
 * // 设置默认渲染器
 * registry.setDefault('input')
 * registry.getDefault() // => 'input'
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

/**
 * 渲染器注册选项。
 */
export interface RegistryOptions {
  /** 是否覆盖已存在的渲染器 */
  override?: boolean
}

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
 * @example
 * ```typescript
 * const renderer = new RendererRegistryType()
 *
 * // 注册组件
 * renderer.register('input', InputRenderer)
 *
 * // 批量注册
 * renderer.registerAll({ text: TextRenderer, number: NumberRenderer })
 * ```
 *
 * @remarks
 * 当 getRenderer 找不到指定类型时，会自动回退到默认渲染器类型（默认为 'text'）。
 */
export class RendererRegistry<
  T extends SchemxRendererKey = SchemxRendererKey,
  R = unknown,
> {
  /** 渲染器存储 */
  private renderers: Map<T, R>

  /** 默认渲染器类型 */
  private defaultType?: T

  /**
   * 创建 Registry 实例。
   *
   * @param defaultType - 默认渲染器类型，未找到指定类型时回退使用
   */
  constructor(defaultType?: T) {
    this.renderers = new Map()
    this.defaultType = defaultType
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
        `[RendererRegistryType] RendererRegistry "${type}" already exists, skipping registration`
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
   * 获取指定类型的渲染器组件。
   *
   * 未找到时自动回退到默认类型，默认类型也不存在则返回 undefined。
   *
   * @param type - 渲染器类型标识
   * @returns 对应的组件，未找到且无默认时返回 undefined
   *
   * @example
   * ```typescript
   * const renderer = renderer.getRenderer('text')
   * const fallback = renderer.getRenderer('unknown') // => 默认渲染器
   * ```
   */
  getRenderer(type: T): R | undefined {
    let renderer = this.renderers.get(type)

    if (!renderer) {
      console.warn(
        `[RendererRegistryType] RendererRegistry "${type}" not found, falling back to default "${this.defaultType}"`
      )

      if (this.defaultType) renderer = this.renderers.get(this.defaultType)
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
   * renderer.hasRenderer('text')   // => true
   * renderer.hasRenderer('custom') // => false
   * ```
   */
  hasRenderer(type: T): boolean {
    return this.renderers.has(type)
  }

  /**
   * 移除渲染器
   *
   * 如果移除的是当前默认类型，会从剩余渲染器中智能选取新默认类型。
   * 若无剩余渲染器则默认类型设为空字符串。
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
    const isDefault = type === this.defaultType
    const deleted = this.renderers.delete(type)

    if (isDefault && deleted) {
      const firstKey = this.renderers.keys().next().value

      if (firstKey) {
        console.warn(
          `[RendererRegistryType] Default renderer was removed, Please reset the default renderer.`
        )

        this.defaultType = firstKey
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
   * renderer.getTypes() // => ['text', 'number', 'date']
   * ```
   */
  getTypes(): T[] {
    return Array.from(this.renderers.keys())
  }

  /**
   * 设置默认渲染器类型
   *
   * 当 getRenderer 找不到指定类型时，会回退到默认类型。
   * 设置的类型必须已注册，否则操作无效。
   *
   * @param type - 渲染器类型标识
   *
   * @example
   * ```typescript
   * renderer.setDefault('number')
   * renderer.getDefault() // => 'number'
   * ```
   */
  setDefault(type: T): void {
    if (!this.renderers.has(type)) {
      console.warn(
        `[RendererRegistryType] Cannot set default to "${type}": renderer not registered`
      )

      return
    }

    this.defaultType = type
  }

  /**
   * 获取当前默认渲染器类型
   *
   * @returns 默认类型标识
   *
   * @example
   * ```typescript
   * renderer.getDefault() // => 'text'
   * ```
   */
  getDefault(): T | undefined {
    return this.defaultType
  }

  /**
   * 清除所有已注册的渲染器并重置默认类型为 'text'。
   *
   * @example
   * ```typescript
   * renderer.clear()
   * renderer.size() // => 0
   * ```
   */
  clear(): void {
    this.renderers.clear()
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
 * RendererRegistryType 的实例类型
 */
export type RendererRegistryType<
  T extends SchemxRendererKey = SchemxRendererKey,
  R = unknown,
> = RendererRegistry<T, R>

/**
 * 创建局部渲染器注册中心实例（仅内部使用）。
 *
 * @param defaultType - 默认渲染器类型
 * @returns 新的 Registry 实例
 *
 * @remarks
 * 用于组件内部创建独立的注册中心实例，
 * 不建议外部直接使用，除非有特殊需求。
 */
export function createRendererRegistry<T extends SchemxRendererKey, R = unknown>(
  defaultType?: T
): RendererRegistryType<T, R> {
  return new RendererRegistry<T, R>(defaultType)
}
