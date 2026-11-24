/**
 * Schema 纯配置编译。

 * @module core/runtime/compiler/createSchemaCompiler
 */

import { isDependencySchema, isDynamicSchema, isGroupSchema } from "../../utils"
import { getDynamicRow } from "../dynamic/rowContext"

import { compileFieldSchema, createNodeKey } from "./helper"

import type {
  SchemaCompiler,
  SchemaCompilerConfig,
  SchemaCompileResult,
  SchemaCompilerOptions,
} from "./types"
import type { SchemxField, Values } from "../../types"
import type { DynamicRowState } from "../node"

/**
 * 按原始 Schema 引用和最终 key 缓存纯编译结果。
 * @typeParam TValues - 表单值类型。
 */
type CompiledConfigCache<TValues extends Values> = WeakMap<
  SchemxField<TValues>,
  Map<string, SchemaCompileResult<TValues>>
>

/**
 * 创建拥有独立编译缓存的 Compiler。
 * @typeParam TValues - 表单值类型。
 * @param options - 编译默认值和 Renderer Props。
 * @returns 纯配置编译和缓存失效入口。
 * @example
 * const compiler = createSchemaCompiler({ config: configuration.getConfig() })
 * const config = compiler.compile(schema, "schemx:root", 0)
 */
export function createSchemaCompiler<TValues extends Values = Values>(
  options: SchemaCompilerOptions<TValues>
): SchemaCompiler<TValues> {
  // 直接持有配置模块的快照；更新和失败恢复都只替换引用。
  let formConfig = options.config

  // 只缓存纯配置，节点的 Signal 和 Scope 始终独立创建。
  let compiledCache: CompiledConfigCache<TValues> = new WeakMap()

  /**
   * 将原始 Schema 编译为不含节点身份和运行资源的配置。
   * @param schema - 按对象引用识别变更的原始 Schema。
   * @param parentKey - 当前父节点的稳定 key。
   * @param index - Schema 在父节点中的位置。
   * @example const config = compiler.compile(schema, "schemx:root", 0)
   */
  const compile = (
    schema: SchemxField<TValues>,
    parentKey: string,
    index: number
  ): SchemaCompileResult<TValues> => {
    // 使用最终 key 作为位置相关的缓存边界，显式稳定 key 不受排序影响。
    const key = createNodeKey(schema, index, parentKey)

    // 当前 Schema 已编译的各个 key。
    const schemaEntries = compiledCache.get(schema)

    // 缓存命中后不重复合并默认值、Props 或创建配置令牌。
    const cached = schemaEntries?.get(key)

    if (cached) {
      return cached
    }

    // 编译后的 Schema 继续使用已有的结构类型，不添加第二份类型标记。
    let compiledSchema: SchemaCompileResult<TValues>["schema"]

    // 仅 Dependency 的行上下文需要在 Schema 之外单独传递。
    let dynamicRow: DynamicRowState | undefined

    if (isDynamicSchema<TValues>(schema)) {
      compiledSchema = {
        ...schema,
        key,
        visible: schema.visible ?? formConfig.schemaConfig.visible,
        readonly: schema.readonly ?? formConfig.schemaConfig.readonly,
        disabled: schema.disabled ?? formConfig.schemaConfig.disabled,
      }
    } else if (isGroupSchema<TValues>(schema)) {
      compiledSchema = {
        ...schema,
        key,
        children: [],
        visible: schema.visible ?? formConfig.schemaConfig.visible,
        readonly: schema.readonly ?? formConfig.schemaConfig.readonly,
        disabled: schema.disabled ?? formConfig.schemaConfig.disabled,
      }
    } else if (isDependencySchema<TValues>(schema)) {
      // 只读取展开阶段关联的类型化行快照，不向业务 Schema 添加内部属性。
      dynamicRow = getDynamicRow(schema)
      compiledSchema = {
        ...schema,
        key,
        visible: schema.visible ?? formConfig.schemaConfig.visible,
        readonly: schema.readonly ?? formConfig.schemaConfig.readonly,
        disabled: schema.disabled ?? formConfig.schemaConfig.disabled,
      }
    } else {
      // 展开和补充 dependencies 不改变 componentType 与 Renderer Props 的对应关系。
      compiledSchema = {
        ...compileFieldSchema<TValues>(schema, key, {
          config: formConfig,
        }),
        key,
        dependencies: schema.dependencies,
      } as SchemaCompileResult<TValues>["schema"]
    }

    // 协调令牌只标识此编译结果，类型与 key 直接从 Schema 读取。
    const compiled: SchemaCompileResult<TValues> = {
      schema: compiledSchema,
      configToken: Symbol(key),
      dynamicRow,
    }

    // 编译成功后才写入缓存，异常不会留下不完整配置。
    const entries = schemaEntries ?? new Map<string, SchemaCompileResult<TValues>>()

    entries.set(key, compiled)
    compiledCache.set(schema, entries)

    return compiled
  }

  /**
   * 替换全部纯配置缓存。
   * @example compiler.invalidateConfigCache()
   */
  const invalidateConfigCache = (): void => {
    compiledCache = new WeakMap()
  }

  /**
   * 替换配置并清空旧快照对应的缓存。
   * @param next - 已合并的最新配置快照。
   */
  const setConfig = (next: SchemaCompilerConfig<TValues>): void => {
    formConfig = next
    invalidateConfigCache()
  }

  return {
    compile,
    invalidateConfigCache,
    setConfig,
  }
}
