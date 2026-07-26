/**
 * Schema compiler 类型定义。
 *
 * 定义 Compile 门面接口和 CompileCache 缓存结构，以及编译错误类型。
 *
 * @module core/runtime/compiler/types
 */

import type {
  NamePath,
  ResolvedSchemxDefaultProps,
  SchemxField,
  SchemxInstance,
  SchemxRendererKey,
  Values,
} from "../../types"
import type { FormDescriptor } from "../descriptor/types"

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
  defaultProps: ResolvedSchemxDefaultProps
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
  defaultRendererType?: SchemxRendererKey
  /**
   * 表单实例方法，用于在编译时提供表单操作能力。
   */
  formInstance: SchemxInstance<TValues>
}

/**
 * Schema 编译缓存。
 *
 * 以 schema 对象引用和编译位置共同缓存 descriptor，让未变化的 schema 在相同位置
 * 多次编译时复用 descriptor。编译位置参与缓存键，因为生成 key 依赖 parentKey 和 index。
 *
 * 缓存通过 `version` 失效：defaultProps 等编译选项变化时调用方 bump version，
 * 后续编译会跳过所有缓存条目。
 */
export interface CompileCache<TValues extends Values = Values> {
  /**
   * 当前缓存版本号，递增后所有缓存条目失效。
   */
  version: number
  /**
   * 以 schema 对象引用和编译位置为键的 descriptor 缓存表。
   */
  entries: WeakMap<
    SchemxField<TValues>,
    Map<string, { version: number; descriptor: FormDescriptor<TValues> }>
  >
}

/**
 * Schema compiler 门面。
 *
 * 封装 descriptor cache 与失效版本，让调用方不直接操作 cache 结构。
 * 提供编译 schema 列表、获取缓存版本号和失效缓存的入口。
 */
export interface Compile<TValues extends Values = Values> {
  /**
   * 当前 compiler 实例持有的 descriptor 引用缓存。
   */
  readonly cache: CompileCache<TValues>
  /**
   * 将 schema 列表编译为 descriptor 列表，并复用未失效的缓存条目。
   *
   * @param schemas - 待编译的 schema 列表。
   * @param parentKey - 父级 descriptor key，用于生成嵌套 key。
   * @returns 编译后的 descriptor 列表。
   */
  toDescriptors(
    schemas: readonly SchemxField<TValues>[],
    parentKey?: string
  ): FormDescriptor<TValues>[]
  /**
   * 失效当前 compiler 实例的缓存。
   */
  invalidate(): void
  /**
   * 获取当前缓存版本号。
   */
  getVersion(): number
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
