/**
 * Schema compiler 实现。
 *
 * 将用户传入的 SchemxField schema 数组编译为 FormDescriptor 列表。
 * 通过 WeakMap 以 schema 对象引用为键，并按父级与索引位置缓存 descriptor。
 * version 机制在编译选项变化时失效缓存，使位置未变的 schema 复用 descriptor。
 *
 * @module core/compiler/createCompile
 */

import { isResolvedDefaultConfig, resolveDefaultConfig } from "../defaultConfig"
import { createDescriptor } from "../descriptor"
import { normalizeSchemas } from "../utils"

import { type Compile, type CompileCache, type CompileOptions } from "./types"

import type { FormDescriptor } from "../descriptor"
import type { SchemxContext } from "../schemxContext"
import type { SchemxDefaultProps, SchemxInstance, Values } from "../types"
import type { SchemxField } from "../types/schema"

/**
 * 创建一个初始 compiler 缓存。
 *
 * @returns 初始 CompileCache，version 从 0 开始，entries 为空 WeakMap。
 */
function createCompileCache<TValues extends Values = Values>(): CompileCache<TValues> {
  return {
    version: 0,
    entries: new WeakMap(),
  }
}

/**
 * 创建 schema compiler。
 *
 * 每个 compiler 实例维护自己的 descriptor cache。调用方通过 `invalidate()`
 * 失效缓存，而不是直接操作缓存版本。
 *
 * @param options - 编译选项，包含默认属性和表单实例。
 * @returns schema compiler 门面，提供 toDescriptors、invalidate 等方法。
 */
export function createCompile<TValues extends Values = Values>(
  options: Partial<Omit<CompileOptions<TValues>, "defaultProps">> & {
    defaultProps?: SchemxDefaultProps
  } = {}
): Compile<TValues> {
  const defaultProps = options.defaultProps ?? {}

  const compileOptions: CompileOptions<TValues> = {
    // createForm 传入的是与 context 共享的已解析对象，必须保留其引用；独立调用
    // createCompile 时才在此补齐内置默认值。
    defaultProps: isResolvedDefaultConfig(defaultProps)
      ? defaultProps
      : resolveDefaultConfig(defaultProps),
    defaultRendererType: options.defaultRendererType,
    formInstance: options.formInstance ?? ({} as SchemxInstance<TValues>),
  }

  const compileCache = createCompileCache<TValues>()

  /**
   * 将 schema 列表编译为 descriptor 列表。
   *
   * 编译时通过显式参数把表单默认配置传给 descriptor 创建流程。
   *
   * @param schemas - 待编译的 schema 列表。
   * @param parentKey - 父级 descriptor key，用于生成嵌套 key。
   * @returns 编译后的 descriptor 列表。
   */
  function toDescriptors(
    schemas: readonly SchemxField<TValues>[],
    parentKey = ""
  ): FormDescriptor<TValues>[] {
    return compileDescriptors(schemas, parentKey)
  }

  /**
   * 实际执行 schema 到 descriptor 的编译。
   *
   * 逐个 schema 查缓存命中则复用，否则按类型生成 descriptor，遇到 group 递归
   * 编译子级，并把新条目写回缓存。
   *
   * @param schemas - 待编译的 schema 列表。
   * @param parentKey - 父级 descriptor key。
   * @returns 编译后的 descriptor 列表。
   * @throws CompileError - dependency schema 缺少非空 trigger 字段时抛出。
   */
  function compileDescriptors(
    schemas: readonly SchemxField<TValues>[],
    parentKey = ""
  ): FormDescriptor<TValues>[] {
    const descriptors: FormDescriptor<TValues>[] = []

    const normalized = normalizeSchemas<TValues>(
      schemas,
      compileOptions.defaultRendererType
    )

    for (let i = 0; i < normalized.length; i++) {
      const schema = normalized[i]

      // 命中缓存且版本未过期时直接复用之前的 descriptor
      const locationKey = createCompileLocationKey(parentKey, i)

      const locationEntries = compileCache.entries.get(schema)

      const cached = locationEntries?.get(locationKey)

      if (cached && cached.version === compileCache.version) {
        descriptors.push(cached.descriptor)
        continue
      }

      const descriptor: FormDescriptor<TValues> = createDescriptor(
        schema,
        i,
        parentKey,
        createFallbackCompileContext()
      )

      // 写入缓存，下次相同 schema 引用可跳过编译
      const nextLocationEntries = locationEntries ?? new Map()

      nextLocationEntries.set(locationKey, {
        version: compileCache.version,
        descriptor,
      })
      compileCache.entries.set(schema, nextLocationEntries)

      descriptors.push(descriptor)
    }

    return descriptors
  }

  /**
   * 在缺少调用方 context 时构建回退 SchemxContext。
   *
   * @returns 由 compileOptions 衍生的最小 SchemxContext。
   */
  function createFallbackCompileContext(): SchemxContext<TValues> {
    return {
      defaultProps: compileOptions.defaultProps,
      instance: compileOptions.formInstance,
    } as SchemxContext<TValues>
  }

  /** 递增缓存版本号，使所有现有缓存条目失效。 */
  function invalidate(): void {
    compileCache.version++
  }

  /** 获取当前缓存版本号。 */
  function getVersion(): number {
    return compileCache.version
  }

  return {
    cache: compileCache,
    toDescriptors,
    invalidate,
    getVersion,
  }
}

function createCompileLocationKey(parentKey: string, index: number): string {
  return JSON.stringify([parentKey, index])
}
