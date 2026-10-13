import type { CreateSchemxOptions } from "../config/schemxOptions"
import type { SchemxInstance, Values } from "../types"

const creationConfigKey = Symbol("schemx:creation-config")

/**
 * 创建时的共享配置及显式继承层；不随 Runtime 更新。
 * @typeParam TValues - 表单值类型。
 */
export interface FormCreationSnapshot<TValues extends Values = Values> {
  /**
   * 最终共享创建配置，包含实际 Registry 和 Core Schema 默认值。
   */
  readonly config: Readonly<CreateSchemxOptions<TValues>>
  /**
   * 捕获的显式继承配置；旧模块级创建路径不提供此字段。
   */
  readonly defaults?: Readonly<CreateSchemxOptions<TValues>>
}

/**
 * 将只读创建记录附加到 Core 实例；可枚举 Symbol 保留 bridge/ref 复制语义。
 * @internal
 * @typeParam TValues - 表单值类型。
 * @param form - 新创建的 Core 实例。
 * @param snapshot - 固定的创建配置记录。
 * @example setFormCreationConfig(form, { config })
 */
export function setFormCreationConfig<TValues extends Values>(
  form: SchemxInstance<TValues>,
  snapshot: FormCreationSnapshot<TValues>
): void {
  Object.defineProperty(form, creationConfigKey, {
    value: Object.freeze(snapshot),
    enumerable: true,
  })
}

/**
 * 读取适配层所需的固定创建记录；非 Core 创建的实例返回 undefined。
 * @typeParam TValues - 表单值类型。
 * @param form - Core 实例或保留其 Symbol 的桥接实例。
 * @example const snapshot = getFormCreationConfig(form)
 */
export function getFormCreationConfig<TValues extends Values>(
  form: SchemxInstance<TValues>
): FormCreationSnapshot<TValues> | undefined {
  return Reflect.get(form, creationConfigKey) as FormCreationSnapshot<TValues> | undefined
}
