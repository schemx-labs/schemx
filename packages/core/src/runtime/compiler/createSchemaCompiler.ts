/**
 * Schema compiler 实现。
 *
 * 将用户传入的 SchemxField schema 编译为 SchemaNode。
 * 通过 WeakMap 以 schema 对象引用为键，并按父级与索引位置缓存配置 token。
 * 配置变化时替换完整缓存，使位置未变的 schema 重新生成配置 token。
 *
 * @module core/runtime/compiler/createSchemaCompiler
 */

import { mergeAndResolveSchemxConfig } from "../../config"
import { isDependencySchema, isDynamicSchema, isGroupSchema } from "../../utils"
import { createDependencyNode } from "../dependency/createNode"
import { createDynamicNode } from "../dynamic/createNode"
import { createFieldNode } from "../field/createNode"
import { createGroupNode } from "../group/createNode"

import { createNodeKey } from "./helper"

import type {
  CreateSchemaCompilerOptions,
  SchemaCompiler,
  SchemaCompilerOptions,
} from "./types"
import type { SchemxField, SchemxInstance, Values } from "../../types"
import type { SchemaNode, Scope } from "../node"

/**
 * 创建 compiler 的私有配置 token 缓存。
 *
 * 每个 compiler 实例独立持有缓存，避免不同表单实例之间复用配置身份。
 */
type ConfigTokenCache<TValues extends Values = Values> = WeakMap<
  SchemxField<TValues>,
  Map<string, symbol>
>

/**
 * 创建空的 compiler 配置 token 缓存。
 *
 * @typeParam TValues - 表单值类型。
 * @returns 新的 compiler 缓存。
 */
function createConfigTokenCache<
  TValues extends Values = Values,
>(): ConfigTokenCache<TValues> {
  return new WeakMap()
}

/**
 * 创建 schema compiler。
 *
 * 每个 compiler 实例维护自己的配置 token 缓存。调用方通过
 * `invalidateConfigCache()` 失效缓存，而不是直接操作缓存版本。
 *
 * @typeParam TValues - 表单值类型。
 * @param options - 可选编译选项，包含默认属性和表单实例。
 * @returns Schema compiler 门面，提供 `createNode()` 和缓存失效方法。
 *
 * @example
 * ```ts
 * const compiler = createSchemaCompiler()
 * const node = compiler.createNode(schema, "schemx:root", 0)
 * ```
 */
export function createSchemaCompiler<TValues extends Values = Values>(
  options: CreateSchemaCompilerOptions<TValues> = {}
): SchemaCompiler<TValues> {
  // 将可选配置归一为节点编译所需的完整选项。
  const compilerOptions: SchemaCompilerOptions<TValues> = {
    schemaConfig: options.schemaConfig ?? mergeAndResolveSchemxConfig().schemaConfig,
    rendererProps: options.rendererProps,
    formInstance: options.formInstance ?? ({} as SchemxInstance<TValues>),
    debug: options.debug,
  }

  // 节点 id 仅在当前 compiler 实例内递增。
  let nextId = 1

  // schema 引用与运行时 key 共同决定配置 token 的复用边界。
  let configTokenCache = createConfigTokenCache<TValues>()

  /**
   * 编译单个 Schema 并创建一个尚未挂载的 SchemaNode。
   *
   * @param schema - 要编译的 Field、Group、Dependency 或 Dynamic Schema。
   * @param parentKey - 父节点的稳定 key。
   * @param index - Schema 在父节点 children 中的位置。
   * @param scope - 可选的节点资源作用域。
   * @returns 尚未挂入 NodeManager 的运行时节点。
   */
  function createNode(
    schema: SchemxField<TValues>,
    parentKey: string,
    index: number,
    scope?: Scope
  ): SchemaNode<TValues> {
    const key = createNodeKey(schema, index, parentKey)

    const configToken = getOrCreateConfigToken(schema, key, configTokenCache)

    const id = nextId++

    const nodeFactoryOptions = {
      id,
      key,
      configToken,
      compilerOptions: compilerOptions,
      scope,
    }

    if (isDynamicSchema(schema)) {
      return createDynamicNode({ ...nodeFactoryOptions, schema })
    }

    if (isGroupSchema(schema)) {
      return createGroupNode({ ...nodeFactoryOptions, schema })
    }

    if (isDependencySchema(schema)) {
      return createDependencyNode({ ...nodeFactoryOptions, schema })
    }

    return createFieldNode({ ...nodeFactoryOptions, schema })
  }

  /**
   * 替换完整 WeakMap，使旧缓存可以随 schema 引用一同回收。
   */
  function invalidateConfigCache(): void {
    configTokenCache = createConfigTokenCache<TValues>()
  }

  return {
    createNode,
    invalidateConfigCache,
    invalidate: invalidateConfigCache,
  }
}

/**
 * 创建 Schema Compiler 的兼容入口。
 *
 * @deprecated 请改用 {@link createSchemaCompiler}。
 */
export const createCompile: typeof createSchemaCompiler = createSchemaCompiler

/**
 * 获取当前 schema/key 对应的稳定配置 token。
 *
 * @typeParam TValues - 表单值类型。
 * @param schema - 配置 token 所属的 Schema 引用。
 * @param key - 运行时节点的稳定 key。
 * @param configTokenCache - 当前 compiler 使用的 token 缓存。
 * @returns 当前 schema/key 对应的配置 token。
 */
function getOrCreateConfigToken<TValues extends Values>(
  schema: SchemxField<TValues>,
  key: string,
  configTokenCache: ConfigTokenCache<TValues>
): symbol {
  const schemaEntries = configTokenCache.get(schema)

  const cached = schemaEntries?.get(key)

  if (cached) {
    return cached
  }

  const configToken = Symbol(key)

  const nextSchemaEntries = schemaEntries ?? new Map<string, symbol>()

  nextSchemaEntries.set(key, configToken)
  configTokenCache.set(schema, nextSchemaEntries)

  return configToken
}
