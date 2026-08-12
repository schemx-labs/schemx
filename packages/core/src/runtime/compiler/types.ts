/**
 * Schema compiler 类型定义。
 *
 * 定义 Compile 门面接口、编译选项和编译错误类型。
 *
 * @module core/runtime/compiler/types
 */

import type {
  NamePath,
  ResolvedSchemxSchemaConfig,
  SchemxField,
  SchemxInstance,
  SchemxRendererKey,
  SchemxRendererPropsMap,
  Values,
} from "../../types"
import type { RuntimeNodeInput } from "../node/input"

/**
 * 编译器选项。
 *
 * 编译 schema 时需要的表单级配置：默认属性和表单实例方法。
 */
export interface CompileOptions<TValues extends Values> {
  /**
   * 表单级默认配置。
   *
   * 这些配置会作为 schema 编译和字段呈现态的默认值，字段自身配置优先级更高。
   */
  schemaConfig: ResolvedSchemxSchemaConfig
  /** 按 Renderer 类型配置的静态默认 Props。 */
  rendererProps?: SchemxRendererPropsMap<TValues>
  /**
   * 缺失 `componentType` 的 field 使用的显式默认渲染器类型。
   *
   * 未配置时不会从 renderer registry 推断默认值。
   *
   * @example
   * ```ts
   * createCompile({ defaultRendererType: "input" })
   * ```
   */
  defaultRendererType?: SchemxRendererKey<TValues>
  /**
   * 表单实例方法，用于在编译时提供表单操作能力。
   */
  formInstance: SchemxInstance<TValues>
}

/**
 * Schema compiler 门面。
 *
 * 封装节点输入缓存；缓存生命周期是 compiler 私有实现。
 */
export interface Compile<TValues extends Values = Values> {
  /**
   * 编译单个 schema 为创建或更新 RuntimeNode 所需的短生命周期输入。
   *
   * 输入不持有子树，也不会挂载到 RuntimeNode；节点创建后只保留其直接配置字段。
   */
  compileNode(
    schema: SchemxField<TValues>,
    parentKey: string,
    index: number
  ): RuntimeNodeInput<TValues>
  /**
   * 失效当前 compiler 实例的缓存。
   */
  invalidate(): void
}

/**
 * 编译错误类。
 *
 * 当 schema 编译过程中遇到无法处理的配置时抛出。
 * 附加 schema key 和 name 以便定位问题字段。
 */
class CompileErrorImpl extends Error {
  /**
   * 触发错误的 schema 的 key（如存在）。
   */
  readonly schemaKey?: string

  /**
   * 触发错误的 schema 的 name path（如存在）。
   */
  readonly schemaName?: NamePath

  /**
   * 构造编译错误。
   *
   * @param message - 错误描述。
   * @param schema - 触发错误的 schema 对象，用于提取 name 和 key 附加到错误实例。
   */
  constructor(message: string, schema?: unknown) {
    super(message)
    this.name = "CompileError"

    if (schema && typeof schema === "object" && "name" in schema) {
      this.schemaName = schema.name as NamePath
    }

    if (schema && typeof schema === "object" && "key" in schema && schema.key) {
      this.schemaKey = schema.key as string
    }
  }
}

/**
 * CompileError 运行时构造器。
 *
 * 将内部类暴露为可导出的构造器，外部可通过 `instanceof CompileError` 判断。
 */
export const CompileError = CompileErrorImpl
