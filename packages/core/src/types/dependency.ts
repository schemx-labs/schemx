/**
 * 动态依赖字段类型定义
 *
 * 定义 Dependency Schema 及其 renderer 执行上下文。
 *
 * @module types/dependency
 */

import type { SchemxDependencyDependencies } from "./dependencies"
import type { NamePath, Values } from "./form"
import type { SchemxFormApi } from "./instance"
import type { SchemxField } from "./schema"

/**
 * dependency schema renderer 执行上下文。
 *
 * signal 会在同一 dependency 节点的新一轮 renderer 开始或节点销毁时 abort，
 * 便于调用方取消远程请求等异步工作。
 */
export interface SchemxDependencyRendererContext {
  /**
   * 中止信号，用于取消渲染器执行。
   */
  abortSignal: AbortSignal
}

/**
 * 动态子树依赖字段配置
 *
 * 根据其他字段的值动态生成一段子 schema，通过 `to` 和 `renderer` 与其他 Schema 区分。
 * 该配置会被编译为 DependencyRendererEffect。
 *
 * @typeParam  TValues - 表单值类型
 */
export interface SchemxDependencyField<
  TValues extends Values = Values,
  TNames extends readonly NamePath<TValues>[] = readonly NamePath<TValues>[],
> {
  /**
   * 唯一标识字段配置的键，供框架层使用，业务方无需设置
   *
   * Core 会为 ViewSchema 补充稳定 `key`，供框架层作为 vnode key 使用。
   * Raw Schema 不包含该字段，也不会被原地修改。
   */
  key?: string
  /**
   * 依赖的字段路径
   */
  to: TNames
  /**
   * 动态列配置生成函数
   */
  renderer: (
    values: TValues,
    form: SchemxFormApi<TValues>,
    context: SchemxDependencyRendererContext
  ) => SchemxField<TValues>[] | Promise<SchemxField<TValues>[]>
  /**
   * 是否呈现动态子树；隐藏时结构 renderer 仍继续响应 `to`。
   */
  visible?: boolean
  /**
   * 是否强制动态子树中的字段只读。
   */
  readonly?: boolean
  /**
   * 是否强制动态子树中的字段禁用。
   */
  disabled?: boolean
  /**
   * 根据表单值动态覆盖 Dependency 的容器状态。
   */
  dependencies?: SchemxDependencyDependencies<TValues>
}
