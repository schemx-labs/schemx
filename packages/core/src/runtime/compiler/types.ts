/**
 * Schema compiler 类型定义。
 *
 * 定义 SchemaCompiler 门面接口、编译选项和编译错误类型。
 *
 * @module core/runtime/compiler/types
 */

import type {
  NamePath,
  SchemxField,
  SchemxInstance,
  SchemxRendererPropsMap,
  SchemxSchemaConfig,
  Values,
} from "../../types"
import type { NodeId, SchemaNode, Scope } from "../node"

/**
 * 编译器选项。
 *
 * 编译 schema 时需要的表单级配置：默认属性和表单实例方法。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface SchemaCompilerOptions<TValues extends Values> {
  /**
   * 表单级默认配置。
   *
   * 这些配置会作为 schema 编译和字段呈现态的默认值，字段自身配置优先级更高。
   */
  schemaConfig: SchemxSchemaConfig
  /**
   * 按 Renderer 类型配置的静态默认 Props。
   */
  rendererProps?: SchemxRendererPropsMap<TValues>
  /**
   * 当前 Form 实例，注入到 Renderer 的公共 Props。
   */
  formInstance: SchemxInstance<TValues>
  /**
   * 是否为 Node 创建 diagnostics Signal。
   */
  debug?: boolean
}

/**
 * @deprecated 请改用 {@link SchemaCompilerOptions}。
 */
export type CompileOptions<TValues extends Values> = SchemaCompilerOptions<TValues>

/**
 * 创建 Compiler 时可覆盖的配置。
 *
 * `schemaConfig` 省略时由 Compiler 补齐 Core 默认值，其余选项保持可选。
 *
 * @typeParam TValues - 表单值类型。
 */
export type CreateSchemaCompilerOptions<TValues extends Values = Values> = Partial<
  Omit<SchemaCompilerOptions<TValues>, "schemaConfig">
> & {
  readonly schemaConfig?: SchemxSchemaConfig
}

/**
 * @deprecated 请改用 {@link CreateSchemaCompilerOptions}。
 */
export type CreateCompileOptions<TValues extends Values = Values> =
  CreateSchemaCompilerOptions<TValues>

/**
 * 单类 Schema Node 工厂共享的编译输入。
 *
 * Compiler 负责分配节点身份和配置令牌；具体 Node 工厂只负责建立对应运行态。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TSchema - 当前工厂接受的具体 Schema 类型。
 */
export interface SchemaNodeFactoryOptions<TValues extends Values, TSchema> {
  /**
   * Compiler 分配的节点 id。
   */
  readonly id: NodeId
  /**
   * Compiler 解析出的稳定节点 key。
   */
  readonly key: string
  /**
   * 用于判断节点配置是否变化的身份令牌。
   */
  readonly configToken: symbol
  /**
   * 当前节点对应的具体 Schema。
   */
  readonly schema: TSchema
  /**
   * 当前 Compiler 共享的配置。
   */
  readonly compilerOptions: SchemaCompilerOptions<TValues>
  /**
   * 节点资源作用域；省略时由工厂创建。
   */
  readonly scope?: Scope
}

/**
 * @deprecated 请改用 {@link SchemaNodeFactoryOptions}。
 */
export type CreateCompiledNodeOptions<
  TValues extends Values,
  TSchema,
> = SchemaNodeFactoryOptions<TValues, TSchema>

/**
 * Schema compiler 门面。
 *
 * 封装节点配置 token 缓存；缓存生命周期是 compiler 私有实现。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface SchemaCompiler<TValues extends Values = Values> {
  /**
   * 编译单个 schema 并创建一个尚未挂载的 SchemaNode。
   *
   * @param schema - 要编译的 Field、Group、Dependency 或 Dynamic Schema。
   * @param parentKey - 父节点的稳定 key。
   * @param index - schema 在父节点 children 中的位置。
   * @param scope - 可选的节点资源作用域；省略时由 compiler 创建。
   * @returns 尚未挂入 NodeManager 的运行时节点。
   */
  createNode(
    schema: SchemxField<TValues>,
    parentKey: string,
    index: number,
    scope?: Scope
  ): SchemaNode<TValues>
  /**
   * 失效当前 compiler 实例的缓存。
   *
   * 下次编译同一 schema 时会重新生成配置 token。
   */
  invalidateConfigCache(): void

  /**
   * @deprecated 请改用 {@link SchemaCompiler.invalidateConfigCache}。
   */
  invalidate(): void
}

/**
 * @deprecated 请改用 {@link SchemaCompiler}。
 */
export type Compile<TValues extends Values = Values> = SchemaCompiler<TValues>

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
 *
 * @example
 * ```ts
 * throw new CompileError("无法编译 schema")
 * ```
 */
export const CompileError = CompileErrorImpl
