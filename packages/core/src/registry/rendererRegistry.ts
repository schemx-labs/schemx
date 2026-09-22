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

import type { SchemxViewFieldSchema } from "../runtime/view"
import type { SchemxInstance, Values } from "../types"
import type { RegistryOptions } from "./types"
import type { SchemxComponentProps } from "../types/componentProps"
import type { SchemxRendererKey } from "../types/renderer"

/** 阻止 fallbackType 反向推断 Registry 的表单值泛型。 */
type RendererRegistryNoInfer<TValues> = [TValues][TValues extends unknown ? 0 : never]

/**
 * Renderer Props 转换器执行时可读取的当前表单上下文。
 *
 * @typeParam TValues - 表单值对象类型。
 */
export interface RendererTransformContext<TValues extends Values = Values> {
  /** 当前字段的最终 ViewSchema。 */
  readonly schema: SchemxViewFieldSchema<TValues>
  /** 当前表单实例。 */
  readonly form: SchemxInstance<TValues>
}

/**
 * Renderer Props 转换器。
 *
 * 转换器必须同步返回最终传给 Renderer 的 Props；返回值不会再与输入 Props 合并。
 *
 * @typeParam TValues - 表单值对象类型。
 * @typeParam TKey - Renderer 类型标识。
 * @param props - 按当前 Renderer 类型推导的只读 Props。
 * @param context - 当前字段的 ViewSchema 与 Form 实例。
 * @returns 最终传给 Renderer 组件的 Props。
 *
 * @example
 * ```ts
 * const transformProps: RendererPropsTransformer = (props, { schema }) => ({
 *   ...props,
 *   placeholder: schema.placeholder,
 * })
 * ```
 */
export type RendererPropsTransformer<
  TValues extends Values = Values,
  TKey extends string = SchemxRendererKey<TValues>,
> = (
  props: Readonly<SchemxComponentProps<TValues, TKey>>,
  context: Readonly<RendererTransformContext<TValues>>
) => Record<string, unknown>

/**
 * 带 Props 转换器的 Renderer 注册描述。
 *
 * @typeParam TRenderer - UI 框架 Renderer 组件类型。
 * @typeParam TValues - 表单值对象类型。
 * @typeParam TKey - Renderer 类型标识。
 */
export interface RendererDescriptor<
  TRenderer = unknown,
  TValues extends Values = Values,
  TKey extends string = SchemxRendererKey<TValues>,
> {
  /** 实际渲染的 UI 组件。 */
  readonly component: TRenderer
  /** 返回最终传给组件的 Props。 */
  readonly transformProps: RendererPropsTransformer<TValues, TKey>
}

/**
 * Renderer 注册输入：直接传组件或传入带 Props 转换器的描述对象。
 *
 * @typeParam TRenderer - UI 框架 Renderer 组件类型。
 * @typeParam TValues - 表单值对象类型。
 * @typeParam TKey - Renderer 类型标识。
 */
export type RendererRegistration<
  TRenderer = unknown,
  TValues extends Values = Values,
  TKey extends string = SchemxRendererKey<TValues>,
> = TRenderer | RendererDescriptor<TRenderer, TValues, TKey>

/**
 * Registry 中规范化后的 Renderer 条目。
 *
 * @typeParam TRenderer - UI 框架 Renderer 组件类型。
 * @typeParam TValues - 表单值对象类型。
 * @typeParam TKey - Renderer 类型标识。
 */
export interface RendererEntry<
  TRenderer = unknown,
  TValues extends Values = Values,
  TKey extends string = SchemxRendererKey<TValues>,
> {
  /** 实际渲染的 UI 组件。 */
  readonly component: TRenderer
  /** 返回最终传给组件的 Props；直接注册组件时为空。 */
  readonly transformProps?: RendererPropsTransformer<TValues, TKey>
}

/**
 * 渲染器映射类型，值可以是组件或带 Props 转换器的描述对象。
 *
 * key 为渲染器类型字符串，value 为对应的 Renderer 注册输入。
 *
 * @typeParam TValues - 表单值对象类型。
 */
export type RendererMap<TValues extends Values = Values> = {
  [TKey in SchemxRendererKey<TValues>]?: RendererRegistration<unknown, TValues, TKey>
}

/**
 * 渲染器注册中心。
 *
 * 纯粹的 Map 存储。
 *
 * @remarks
 * 当 {@link RendererRegistry.resolve} 找不到指定类型时，会回退到构造函数或
 * {@link RendererRegistry.setFallback} 设置的回退类型；未设置时不会回退。
 *
 * @typeParam TValues - 表单值对象类型。
 */
class RendererRegistryImpl<TValues extends Values = Values> {
  /**
   * 渲染器存储。
   */
  private renderers: Map<SchemxRendererKey<TValues>, RendererEntry<unknown, TValues>>

  /**
   * 未找到匹配渲染器时使用的回退类型。
   */
  private fallbackType?: SchemxRendererKey<TValues>

  /**
   * 创建 Registry 实例。
   *
   * @param fallbackType - 回退渲染器类型，未找到指定类型时回退使用
   */
  constructor(fallbackType?: SchemxRendererKey<TValues>) {
    this.renderers = new Map()
    this.fallbackType = fallbackType
  }

  /**
   * 注册带 Props 转换器的 Renderer。
   *
   * 默认覆盖同名项；可通过 `options.override` 禁止覆盖。
   *
   * @typeParam TKey - 当前 Renderer key 类型。
   * @param type - Renderer 类型标识。
   * @param renderer - 组件与同步 Props 转换器。
   * @param options - 同名项的覆盖策略。
   *
   * @example
   * ```ts
   * registry.register("input", {
   *   component: InputRenderer,
   *   transformProps: (props) => ({ ...props, disabled: true }),
   * })
   * ```
   */
  register<TKey extends SchemxRendererKey<TValues>>(
    type: TKey,
    renderer: RendererDescriptor<unknown, TValues, TKey>,
    options?: RegistryOptions
  ): void

  /**
   * 注册组件本身作为 Renderer。
   *
   * 默认覆盖同名项；可通过 `options.override` 禁止覆盖。
   *
   * @param type - Renderer 类型标识。
   * @param renderer - 要注册的 UI 组件。
   * @param options - 同名项的覆盖策略。
   *
   * @example
   * ```ts
   * registry.register("input", InputRenderer)
   * ```
   */
  register(
    type: SchemxRendererKey<TValues>,
    renderer: unknown,
    options?: RegistryOptions
  ): void

  register(
    type: SchemxRendererKey<TValues>,
    renderer: unknown,
    options?: RegistryOptions
  ): void {
    if (this.renderers.has(type) && options?.override === false) {
      console.warn(`[schemx] 渲染器 "${type}" 已存在，跳过注册`)

      return
    }

    this.renderers.set(
      type,
      normalizeRenderer<unknown, TValues, SchemxRendererKey<TValues>>(
        renderer as RendererRegistration<unknown, TValues, SchemxRendererKey<TValues>>
      )
    )
  }

  /**
   * 批量注册带 Props 转换器的 Renderer。
   *
   * 同名项会被覆盖。
   *
   * @param renderers - Renderer 类型到描述对象的映射。
   *
   * @example
   * ```ts
   * registry.registerAll({
   *   input: {
   *     component: InputRenderer,
   *     transformProps: (props) => ({ ...props, disabled: true }),
   *   },
   * })
   * ```
   */
  registerAll(renderers: {
    [TKey in SchemxRendererKey<TValues>]?: RendererDescriptor<unknown, TValues, TKey>
  }): void

  /**
   * 批量注册组件或 Renderer 描述对象。
   *
   * 同名项会被覆盖。
   *
   * @param renderers - Renderer 类型到组件或描述对象的映射。
   *
   * @example
   * ```ts
   * registry.registerAll({
   *   input: InputRenderer,
   *   custom: {
   *     component: CustomRenderer,
   *     transformProps: (props) => ({ ...props, disabled: true }),
   *   },
   * })
   * ```
   */
  registerAll(renderers: RendererMap<TValues>): void

  registerAll(renderers: Record<string, unknown>): void {
    Object.entries(renderers).forEach(([type, renderer]) => {
      this.renderers.set(
        type as SchemxRendererKey<TValues>,
        normalizeRenderer<unknown, TValues, SchemxRendererKey<TValues>>(
          renderer as RendererRegistration<unknown, TValues, SchemxRendererKey<TValues>>
        )
      )
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
  get(type: SchemxRendererKey<TValues>): unknown | undefined {
    return this.renderers.get(type)?.component
  }

  /**
   * 纯查询：获取指定类型的规范化 Renderer 条目。
   *
   * 未找到时返回 `undefined`，不触发回退、不发出警告。
   *
   * @typeParam TKey - 查询的 Renderer key 类型。
   * @param type - 渲染器类型标识
   * @returns Renderer 组件及可选的 Props 转换器
   *
   * @example
   * ```ts
   * const entry = registry.getEntry("input")
   * ```
   */
  getEntry<TKey extends SchemxRendererKey<TValues>>(
    type: TKey
  ): RendererEntry<unknown, TValues, TKey> | undefined {
    return this.renderers.get(type) as RendererEntry<unknown, TValues, TKey> | undefined
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
  resolve(type: SchemxRendererKey<TValues>): unknown | undefined {
    return this.resolveEntry(type)?.component
  }

  /**
   * 解析 Renderer 条目：未命中时回退到回退类型。
   * 未命中时会发出警告；没有可用回退项时返回 `undefined`。
   *
   * @param type - 渲染器类型标识
   * @returns 对应的 Renderer 条目，未找到且无回退时返回 undefined
   *
   * @example
   * ```ts
   * const entry = registry.resolveEntry("input")
   * ```
   */
  resolveEntry(
    type: SchemxRendererKey<TValues>
  ): RendererEntry<unknown, TValues> | undefined {
    let renderer = this.renderers.get(type)

    if (!renderer) {
      console.warn(`[schemx] 未找到渲染器 "${type}"，回退到 "${this.fallbackType}"`)

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
  has(type: SchemxRendererKey<TValues>): boolean {
    return this.renderers.has(type)
  }

  /**
   * 移除渲染器
   *
   * 如果移除的是当前回退类型，会从剩余渲染器中智能选取新回退类型。
   * 若无剩余渲染器，回退类型保持原值，但无法解析出组件。
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
  unregister(type: SchemxRendererKey<TValues>): boolean {
    const isFallback = type === this.fallbackType

    const deleted = this.renderers.delete(type)

    if (isFallback && deleted) {
      const firstKey = this.renderers.keys().next().value

      if (firstKey) {
        console.warn(`[schemx] 回退渲染器已移除，已自动重置为 "${String(firstKey)}"`)

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
  keys(): SchemxRendererKey<TValues>[] {
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
  setFallback(type: SchemxRendererKey<TValues>): void {
    if (!this.renderers.has(type)) {
      console.warn(`[schemx] 无法将未注册的渲染器 "${type}" 设为回退渲染器`)

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
  getFallback(): SchemxRendererKey<TValues> | undefined {
    return this.fallbackType
  }

  /**
   * 清除所有已注册的渲染器和回退类型。
   *
   * @example
   * ```typescript
   * renderer.clear()
   * renderer.size() // => 0
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

/** 由 {@link createRendererRegistry} 创建的 Renderer 注册表类型。 */
/**
 * 由 {@link createRendererRegistry} 创建的 Renderer 注册表类型。
 *
 * @example
 * ```ts
 * const registry: RendererRegistry = createRendererRegistry("input")
 * ```
 */
export type RendererRegistry<TValues extends Values = Values> =
  RendererRegistryImpl<TValues>

/**
 * 创建独立的渲染器注册中心实例。
 *
 * @param fallbackType - 回退渲染器类型
 * @returns 新的 Registry 实例
 *
 * @remarks
 * 调用方可以通过 `fallbackType` 配置未命中时使用的回退类型。
 *
 * @typeParam TValues - 表单值对象类型。
 *
 * @example
 * ```ts
 * const registry = createRendererRegistry("input")
 * registry.register("input", InputRenderer)
 * ```
 */
export function createRendererRegistry<TValues extends Values = Values>(
  fallbackType?: SchemxRendererKey<RendererRegistryNoInfer<TValues>>
): RendererRegistry<TValues> {
  return new RendererRegistryImpl<TValues>(fallbackType)
}

/**
 * 判断注册输入是否为带 Props 转换器的描述对象。
 *
 * @param renderer - Renderer 注册输入。
 * @returns 是否为 Renderer 描述对象。
 */
function isRendererDescriptor<TRenderer, TValues extends Values, TKey extends string>(
  renderer: RendererRegistration<TRenderer, TValues, TKey>
): renderer is RendererDescriptor<TRenderer, TValues, TKey> {
  if (typeof renderer !== "object" || renderer === null) {
    return false
  }

  const candidate = renderer as Record<string, unknown>

  return "component" in candidate && typeof candidate.transformProps === "function"
}

/**
 * 将组件或描述对象规范化为 Registry 内部条目。
 *
 * @param renderer - Renderer 注册输入。
 * @returns 规范化后的 Renderer 条目。
 */
function normalizeRenderer<TRenderer, TValues extends Values, TKey extends string>(
  renderer: RendererRegistration<TRenderer, TValues, TKey>
): RendererEntry<TRenderer, TValues, TKey> {
  if (isRendererDescriptor(renderer)) {
    return {
      component: renderer.component,
      transformProps: renderer.transformProps,
    }
  }

  return { component: renderer as TRenderer }
}
