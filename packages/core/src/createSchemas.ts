/**
 * Schema source 创建工具。
 *
 * @module core/createSchemas
 *
 * @example
 * ```ts
 * import { createSchemas, isSchemxSchemas } from '@schemx/core'
 *
 * // 创建空 schemas
 * const schemas = createSchemas()
 *
 * // 创建带初始值的 schemas
 * const schemas = createSchemas([
 *   { name: 'username', label: '用户名', componentType: 'input' },
 *   { name: 'email', label: '邮箱', componentType: 'input' }
 * ])
 *
 * // 读取当前 schemas
 * const current = schemas.value
 * const snapshot = schemas.peek() // 无追踪读取
 *
 * // 替换整个 schemas
 * schemas.set([
 *   { name: 'newField', label: '新字段', componentType: 'input' }
 * ])
 *
 * // 基于当前值更新
 * schemas.update(prev => [
 *   ...prev,
 *   { name: 'additional', label: '附加字段', componentType: 'input' }
 * ])
 *
 * // 订阅变化
 * const dispose = schemas.subscribe(nextSchemas => {
 *   console.log('Schemas 已更新:', nextSchemas)
 * })
 *
 * dispose() // 取消订阅
 * ```
 *
 * @example
 * ```ts
 * // 与 createForm 配合使用
 * const schemas = createSchemas([
 *   { name: 'username', label: '用户名', componentType: 'input' }
 * ])
 *
 * const form = createForm({ schemas })
 *
 * // 动态添加字段
 * schemas.update(prev => [
 *   ...prev,
 *   { name: 'email', label: '邮箱', componentType: 'input' }
 * ])
 *
 * // 表单会自动响应 schemas 变化
 * ```
 */

import { createSignal } from "./reactivity"

import type { ReadonlySignal } from "./reactivity"
import type { Values } from "./types/form"
import type { SchemxField } from "./types/schema"

/**
 * schema source 变化订阅回调。
 *
 * @typeParam TValues - 表单值类型。
 */
export type SchemxSchemasListener<TValues extends Values = Values> = (
  schemas: readonly SchemxField<TValues>[]
) => void

/**
 * 可响应式更新的 root schema source。
 *
 * @typeParam TValues - 表单值类型。
 *
 * @example
 * ```ts
 * const schemas: SchemxSchemas = createSchemas([
 *   { name: 'field1', label: '字段1', componentType: 'input' }
 * ])
 *
 * // 响应式读取（在 effect 中会追踪）
 * console.log(schemas.value)
 *
 * // 无追踪读取
 * console.log(schemas.peek())
 *
 * // 设置新值
 * schemas.set([{ name: 'field2', label: '字段2', componentType: 'input' }])
 *
 * // 更新
 * schemas.update(prev => [...prev, newSchema])
 *
 * // 订阅
 * const dispose = schemas.subscribe(next => console.log(next))
 * ```
 */
export interface SchemxSchemas<TValues extends Values = Values> {
  /** 当前 schema 列表的只读 signal。 */
  readonly signal: ReadonlySignal<readonly SchemxField<TValues>[]>
  /** 当前 schema 列表。 */
  readonly value: readonly SchemxField<TValues>[]
  /** 无依赖追踪地读取当前 schema 列表。 */
  peek: () => readonly SchemxField<TValues>[]
  /** 替换当前 schema 列表。 */
  set: (schemas: readonly SchemxField<TValues>[]) => void
  /** 基于当前 schema 列表派生下一版。 */
  update: (
    updater: (schemas: readonly SchemxField<TValues>[]) => readonly SchemxField<TValues>[]
  ) => void
  /** 订阅 schema 列表变化。 */
  subscribe: (listener: SchemxSchemasListener<TValues>) => () => void
}

/**
 * createForm 可接收的 schema 输入。
 *
 * @typeParam TValues - 表单值类型。
 */
export type SchemxSchemasInput<TValues extends Values = Values> =
  | readonly SchemxField<TValues>[]
  | SchemxSchemas<TValues>

/**
 * 创建空 schema source。
 *
 * @typeParam TValues - 表单值类型。
 * @returns 可响应式更新的 schema source。
 *
 * @example
 * ```ts
 * const schemas = createSchemas()
 * schemas.set([
 *   { name: 'field1', label: '字段1', componentType: 'input' }
 * ])
 * ```
 */
export function createSchemas<TValues extends Values = Values>(): SchemxSchemas<TValues>

/**
 * 创建 schema source。
 *
 * @typeParam TValues - 表单值类型。
 * @param schemas - 初始 root schema 列表。
 *
 * @returns 可响应式更新的 schema source。
 *
 * @example
 * ```ts
 * const schemas = createSchemas([
 *   { name: 'username', label: '用户名', componentType: 'input' },
 *   { name: 'email', label: '邮箱', componentType: 'input' }
 * ])
 *
 * // 在 form 中使用
 * const form = createForm({ schemas })
 * ```
 */
export function createSchemas<TValues extends Values = Values>(
  schemas: readonly SchemxField<TValues>[]
): SchemxSchemas<TValues>

export function createSchemas<TValues extends Values = Values>(
  schemas: readonly SchemxField<TValues>[] = []
): SchemxSchemas<TValues> {
  const source = createSignal<readonly SchemxField<TValues>[]>(schemas)

  /**
   * 响应式读取当前 schema 列表。
   */
  const getValue = (): readonly SchemxField<TValues>[] => {
    return source.value
  }

  /**
   * 无依赖追踪地读取当前 schema 列表。
   */
  const peek = (): readonly SchemxField<TValues>[] => {
    return source.peek()
  }

  /**
   * 替换 schema 列表并通知订阅者。
   */
  const set = (nextSchemas: readonly SchemxField<TValues>[]): void => {
    source.value = nextSchemas
  }

  /**
   * 基于当前 schema 列表派生下一版并通知订阅者。
   */
  const update = (
    updater: (schemas: readonly SchemxField<TValues>[]) => readonly SchemxField<TValues>[]
  ): void => {
    source.value = updater(source.peek())
  }

  /**
   * 注册 schema source 的手动订阅者。
   */
  const subscribe = (listener: SchemxSchemasListener<TValues>): (() => void) => {
    let isInitialNotify = true
    const unsubscribe = source.subscribe((value) => {
      if (isInitialNotify) {
        isInitialNotify = false

        return
      }

      listener(value)
    })

    return () => {
      unsubscribe()
    }
  }

  return {
    signal: source,
    get value() {
      return getValue()
    },
    peek,
    set,
    update,
    subscribe,
  }
}

/**
 * 判断输入是否为 schema source。
 *
 * @param schemas - createForm 接收的 schema 输入。
 * @returns true 表示输入是 schema source。
 *
 * @example
 * ```ts
 * const staticSchemas = [{ name: 'field', label: '字段', componentType: 'input' }]
 * const reactiveSchemas = createSchemas(staticSchemas)
 *
 * isSchemxSchemas(staticSchemas)   // => false（是数组）
 * isSchemxSchemas(reactiveSchemas) // => true（是 SchemxSchemas）
 *
 * // 在 createForm 中使用
 * const form = createForm({
 *   schemas: isSchemxSchemas(input) ? input : createSchemas(input)
 * })
 * ```
 */
export function isSchemxSchemas<TValues extends Values = Values>(
  schemas: SchemxSchemasInput<TValues> | undefined
): schemas is SchemxSchemas<TValues> {
  if (!schemas || Array.isArray(schemas)) {
    return false
  }

  const candidate = schemas as Partial<SchemxSchemas<TValues>>

  return (
    typeof candidate.peek === "function" &&
    typeof candidate.set === "function" &&
    typeof candidate.update === "function" &&
    typeof candidate.subscribe === "function"
  )
}
