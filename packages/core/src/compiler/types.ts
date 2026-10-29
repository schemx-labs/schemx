/**
 * Schema compiler 类型定义。
 *
 * 定义 SchemaCompiler 门面接口、编译选项和编译错误类型。
 *
 * @module core/compiler/types
 */

import type { ResolvedFormConfig } from "../config/createFormConfig"
import type { DynamicRowState, NodeId, SchemaNode, Scope } from "../node"
import type { NamePath, SchemxField, Values } from "../types"

/**
 * Compiler 直接消费的表单配置快照，不解析上层配置。
 * @typeParam TValues - 当前表单值类型。
 */
export type SchemaCompilerConfig<TValues extends Values> = Pick<
  ResolvedFormConfig<TValues>,
  "schemaConfig" | "rendererProps" | "debug"
>

/**
 * 配置模块生成的编译输入。
 * @typeParam TValues - 当前表单值类型。
 */
export interface SchemaCompilerOptions<TValues extends Values> {
  /**
   * 配置模块生成的完整编译输入。
   */
  readonly config: SchemaCompilerConfig<TValues>
}

/**
 * 数组行工厂接收的位置与 Store key；身份只由 Compiler 分配。
 */
export interface CreateDynamicRowOptions {
  /**
   * Store 提供的稳定行 key。
   */
  readonly key: string
  /**
   * 当前数组索引。
   */
  readonly index: number
  /**
   * 当前行的完整数据路径。
   */
  readonly path: string
}

/**
 * 编译后的 Schema 与协调所需元数据，不重复声明 Schema 的结构类型。
 * @typeParam TValues - 表单值类型。
 */
export interface SchemaCompileResult<TValues extends Values = Values> {
  /**
   * 已合并默认值并补齐稳定 key 的 Schema，通过现有 Schema helper 判断具体类型。
   */
  readonly schema: SchemxField<TValues> & {
    /**
     * Compiler 已解析的稳定 key。
     */
    readonly key: string
  }
  /**
   * 配置引用和 key 对应的编译令牌。
   */
  readonly configToken: symbol
  /**
   * 数组行内 Dependency 的身份和位置快照，其他 Schema 不设置。
   */
  readonly dynamicRow?: DynamicRowState
}

/**
 * 单类 Node 工厂接收已编译配置，仅创建对应运行态。
 *
 * @typeParam TSchema - 当前工厂接受的已编译 Schema 类型。
 */
export interface SchemaNodeFactoryOptions<TSchema> {
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
   * 已完成默认值合并的节点配置，工厂不再编译或改写该对象。
   */
  readonly schema: TSchema
  /**
   * 是否为字段创建诊断 Signal。
   */
  readonly debug?: boolean
  /**
   * 调用方创建的节点独占作用域，工厂直接使用。
   */
  readonly scope: Scope
}

/**
 * Schema compiler 门面。
 *
 * 封装节点配置 token 缓存；缓存生命周期是 compiler 私有实现。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface SchemaCompiler<TValues extends Values = Values> {
  /**
   * 编译并缓存纯配置，不创建节点、Scope 或响应式资源。
   * @param schema - 按对象引用识别变更的原始 Schema。
   * @param parentKey - 父节点的稳定 key。
   * @param index - Schema 在父节点中的位置。
   * @example const config = compiler.compile(schema, "schemx:root", 0)
   */
  compile(
    schema: SchemxField<TValues>,
    parentKey: string,
    index: number
  ): SchemaCompileResult<TValues>
  /**
   * 为新数组行创建身份和位置记录，与 Schema 节点共用私有序列。
   * @param options - Store 行 key 和当前行位置。
   * @example const row = compiler.createDynamicRow({ key: "row", index: 0, path: "users.0" })
   */
  createDynamicRow(options: CreateDynamicRowOptions): DynamicRowState
  /**
   * 为已编译配置分配身份并创建尚未挂载的 SchemaNode。
   *
   * @param config - compile 返回的纯配置。
   * @param scope - 调用方创建的节点独占作用域，创建失败时释放。
   * @returns 拥有独立身份和运行资源的节点。
   * @example const node = compiler.createNode(compiler.compile(schema, "schemx:root", 0), parent.scope.child())
   */
  createNode(config: SchemaCompileResult<TValues>, scope: Scope): SchemaNode<TValues>
  /**
   * 失效当前 compiler 实例的缓存。
   *
   * 下次编译同一 schema 时会重新生成配置 token。
   */
  invalidateConfigCache(): void
  /**
   * 替换配置快照并失效编译缓存，不重新创建 Compiler。
   * @param config - 配置模块生成的最新编译输入。
   * @example compiler.setConfig(configuration.getConfig())
   */
  setConfig(config: SchemaCompilerConfig<TValues>): void
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
 *
 * @example
 * ```ts
 * throw new CompileError("无法编译 schema")
 * ```
 */
export const CompileError = CompileErrorImpl
