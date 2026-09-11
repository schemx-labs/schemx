/**
 * Schema 基础和公开类型
 *
 * 定义 Schema 的基础组合类型，以及对外公开的字段联合类型。
 *
 * @module types/schema
 */

import type { SchemxDependencyField } from "./dependency"
import type {
  SchemxDynamicArrayPath,
  SchemxDynamicField,
  SchemxDynamicItemValue,
} from "./dynamic"
import type { SchemxBase, SchemxExactBaseField } from "./field"
import type { NamePath, Values } from "./form"
import type { SchemxGroupField } from "./group"
import type { SchemxRendererDefinition } from "./renderer"

declare const schemxValuesHint: unique symbol

export type SchemxValuesHint<TValues extends Values> = {
  readonly [schemxValuesHint]?: TValues
}

/**
 * Schema 数组使用的 Renderer 判别联合。
 *
 * 仅按 Renderer 展开，避免与字段路径生成规模过大的笛卡尔联合。
 */
type SchemxRendererField<TValues extends Values> = [
  Extract<keyof SchemxRendererDefinition<TValues>, string>,
] extends [never]
  ? SchemxBase<TValues, NamePath<TValues>, string>
  : {
      [TKey in Extract<keyof SchemxRendererDefinition<TValues>, string>]: SchemxBase<
        TValues,
        NamePath<TValues>,
        TKey
      >
    }[Extract<keyof SchemxRendererDefinition<TValues>, string>]

/**
 * 字段配置联合类型
 *
 * 表单 schemas 数组中每个元素的类型。
 *
 * @typeParam  TValues - 表单值类型
 */
type SchemxNameDependentField<TValues extends Values> = {
  [TName in NamePath<TValues>]: Pick<
    SchemxBase<TValues, TName>,
    "name" | "dependencies" | "required" | "initialValue" | "rules" | "onChange"
  >
}[NamePath<TValues>]

type SchemxRendererShape<TValues extends Values> = SchemxRendererField<TValues> extends infer TField
  ? TField extends SchemxBase<TValues>
    ? Omit<
        TField,
        "name" | "dependencies" | "required" | "initialValue" | "rules" | "onChange"
      >
    : never
  : never

type SchemxOpenField = {
  readonly key?: string
  readonly name: string
  readonly label: string
  readonly componentType: string
  readonly layout?: unknown
  readonly dependencies?: unknown
  readonly componentProps?: unknown
  readonly preserve?: boolean
  readonly placeholder?: string
  readonly required?: unknown
  readonly showRequiredMark?: boolean
  readonly readonly?: boolean
  readonly readonlyPlaceholder?: string
  readonly disabled?: boolean
  readonly visible?: boolean
  readonly initialValue?: unknown
  readonly rules?: unknown
  readonly labelIcon?: string
  readonly labelAlign?: "left" | "center" | "right"
  readonly labelPosition?: "left" | "top" | "right"
  readonly labelWidth?: string
  readonly contentAlign?: "left" | "center" | "right"
  readonly colon?: boolean
  readonly validationTrigger?: unknown
  readonly onChange?: (...args: never[]) => unknown
  readonly onBlur?: (...args: never[]) => unknown
  readonly children?: never
  readonly to?: never
  readonly renderer?: never
  readonly [key: string]: unknown
}

type SchemxOpenGroup = Omit<SchemxGroupField<Values>, "children"> & {
  readonly children: readonly unknown[]
}

type SchemxOpenDependency = Omit<SchemxDependencyField<Values>, "renderer"> & {
  readonly renderer: (...args: never[]) => unknown
}

type SchemxOpenDynamic = {
  readonly key: string
  readonly name: string
  readonly item: readonly unknown[]
  readonly label?: string
  readonly layout?: unknown
  readonly visible?: boolean
  readonly readonly?: boolean
  readonly disabled?: boolean
  readonly dependencies?: unknown
}

type SchemxOpenSchema =
  | SchemxOpenField
  | SchemxOpenGroup
  | SchemxOpenDependency
  | SchemxOpenDynamic

type SchemxPublicSchema<TValues extends Values> = string extends keyof TValues
  ? SchemxOpenSchema
  :
      | SchemxExactBaseField<TValues>
      | SchemxGroupField<TValues>
      | SchemxDependencyField<TValues>
      | SchemxPublicDynamicField<TValues>

type SchemxPublicDynamicField<TValues extends Values> =
  string extends keyof TValues
    ? SchemxDynamicField<TValues, any>
    : [SchemxDynamicArrayPath<TValues>] extends [never]
      ? SchemxDynamicField<TValues, any>
      : {
          [TPath in SchemxDynamicArrayPath<TValues>]: Omit<
            SchemxDynamicField<TValues, SchemxDynamicItemValue<TValues, TPath>>,
            "name"
          > & { name: TPath }
        }[SchemxDynamicArrayPath<TValues>] | SchemxDynamicField<TValues, any>

/**
 * 公共 Schema 输入类型。
 *
 * 具体表单值类型按字段名和 Renderer key 分发；开放索引类型回退到宽结构。
 * `SchemxValuesHint` 只用于从已声明 Schema 数组反向推导表单值类型，不产生运行时属性。
 */
export type SchemxField<TValues extends Values = Values> =
  SchemxPublicSchema<TValues> & SchemxValuesHint<TValues>

/**
 * 从公共 Schema 或 Schema source 类型中提取其表单值类型。
 *
 * 该工具类型供 createForm/createSchemas 的输入重载使用；普通消费端无需直接引用。
 */
export type SchemxSchemaValues<TSchema> = TSchema extends readonly (infer TSchemaItem)[]
  ? SchemxSchemaValues<TSchemaItem>
  : TSchema extends SchemxValuesHint<infer TValues>
    ? TValues
    : TSchema extends { readonly value: readonly (infer TSchemaItem)[] }
      ? SchemxSchemaValues<TSchemaItem>
      : never
