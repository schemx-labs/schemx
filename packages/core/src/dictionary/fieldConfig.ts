/**
 * 根据已声明的 Renderer Props 推导字段字典的输出。
 */

import type { ReservedDictionaryTarget } from "./target"
import type { DictionaryKeyMap, SchemxDictionary, SchemxDictionaryInput } from "./types"
import type { Values } from "../types/form"
import type { SchemxRendererDefinition } from "../types/renderer"

/**
 * 可接收选项列表的 Renderer 属性。
 * @typeParam TProps - 对应 Renderer 的 Props。
 */
type ArrayTarget<TProps> = Exclude<
  {
    [TKey in keyof TProps]-?: [NonNullable<TProps[TKey]>] extends [never]
      ? never
      : NonNullable<TProps[TKey]> extends readonly unknown[]
        ? TKey
        : never
  }[keyof TProps] &
    string,
  ReservedDictionaryTarget
>

/**
 * 从数组 Props 提取单项类型。
 * @typeParam TList - 可选的 Renderer 数组属性。
 */
type OptionOf<TList> =
  NonNullable<TList> extends readonly (infer TOption)[] ? TOption : never

/**
 * Renderer 的默认目标应当接收字段省略 targetKey 时推导出的选项。
 * @typeParam TProps - 对应 Renderer 的 Props。
 */
type DefaultTargetFor<TProps> =
  "options" extends ArrayTarget<TProps>
    ? {
        [TTarget in ArrayTarget<TProps>]: [
          OptionOf<TProps["options" & keyof TProps]>,
        ] extends [OptionOf<TProps[TTarget]>]
          ? TTarget
          : never
      }[ArrayTarget<TProps>]
    : ArrayTarget<TProps>

/**
 * 从 Renderer Props 推导字典的默认目标。无 Props 声明时允许通用目标。
 * @typeParam TValues - 完整表单值。
 * @typeParam TKey - 当前 Renderer 类型。
 */
export type RendererDictionaryTarget<
  TValues extends Values,
  TKey extends string,
> = TKey extends keyof SchemxRendererDefinition<TValues>
  ? DefaultTargetFor<SchemxRendererDefinition<TValues>[TKey]>
  : string

/**
 * 默认目标可以省略，自定义目标需要显式配置。
 * @typeParam TTarget - 数组属性名。
 */
type Target<TTarget extends string> = TTarget extends "options"
  ? { targetKey?: TTarget }
  : { targetKey: TTarget }

/**
 * 直接加载的响应必须是最终选项。需要转换时允许任意原始响应。
 * @typeParam TValues - 完整表单值。
 * @typeParam TOption - 组件接收的单项类型。
 */
type DictionarySource<TValues extends Values, TOption> =
  | (Omit<
      SchemxDictionary<TValues, readonly TOption[], TOption>,
      "formatter" | "keys"
    > & {
      /** 直接加载不执行响应转换。 */
      formatter?: never
      /** 直接加载不需要字段映射。 */
      keys?: never
    })
  | (SchemxDictionary<TValues, unknown, TOption> &
      (
        | {
            formatter: NonNullable<
              SchemxDictionary<TValues, unknown, TOption>["formatter"]
            >
          }
        | { keys: DictionaryKeyMap }
      ))

/**
 * 已知组件的字典目标及选项类型。
 * @typeParam TValues - 完整表单值。
 * @typeParam TProps - 对应 Renderer 的 Props。
 */
type DictionaryForProps<TValues extends Values, TProps> =
  | {
      [TTarget in ArrayTarget<TProps>]: Target<TTarget> &
        DictionarySource<TValues, OptionOf<TProps[TTarget]>>
    }[ArrayTarget<TProps>]
  | ("options" extends ArrayTarget<TProps>
      ? SchemxDictionary<
          TValues,
          readonly OptionOf<TProps["options" & keyof TProps]>[]
        >["api"]
      : never)

/**
 * 字段字典配置，按组件类型关联选项。无 Props 声明时使用通用配置。
 * @typeParam TValues - 完整表单值。
 * @typeParam TKey - 当前 Renderer 类型。
 */
export type FieldDictionaryConfig<TValues extends Values, TKey extends string> =
  | false
  | (TKey extends keyof SchemxRendererDefinition<TValues>
      ? DictionaryForProps<TValues, SchemxRendererDefinition<TValues>[TKey]>
      : SchemxDictionaryInput<TValues>)
