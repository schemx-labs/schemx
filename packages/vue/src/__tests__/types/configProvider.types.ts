import { useForm } from "../../index"

import type {
  ConfigProviderProps,
  CreateFormOptions,
  SchemxConfig,
  SchemxFormProps,
  SchemxSchemaConfig,
  UseFormOptions,
} from "../../index"
import type { CreateSchemxOptions } from "@schemx/core"

interface FormValues {
  name: string
}

const providerProps: ConfigProviderProps<FormValues> = {
  schemaConfig: {
    readonly: true,
    labelAlign: "left",
    labelWidth: 120,
  },
  rendererProps: {
    input: {
      placeholder: "请输入姓名",
    },
  },
  validatorAdapters: [],
  defaultRendererType: "input",
}

// 嵌套默认值既可用于 App 配置，也可用于创建具体表单。
const config = {
  schemaConfig: {
    readonly: true,
    col: { span: 12 },
    row: { gutter: 8 },
    errorAlign: "left",
    required: {
      isEmpty: (value) => !value?.trim(),
    },
  },
} satisfies SchemxConfig<FormValues>

const formOptions: UseFormOptions<FormValues> = {
  ...config,
  initialValues: { name: "姓名" },
}

const invalidRequired: SchemxConfig<{ age: number }> = {
  schemaConfig: {
    required: {
      isEmpty: (value) => {
        // @ts-expect-error 嵌套必填配置保留当前表单的字段值类型。
        return !value?.trim()
      },
    },
  },
}

// @ts-expect-error ConfigProvider 不接受额外的 config 包装层。
const invalidProviderProps: ConfigProviderProps = { config: {} }

void providerProps
void invalidProviderProps
void config
void formOptions
void invalidRequired

const invalidFlatProvider: ConfigProviderProps = {
  // @ts-expect-error Provider 字段默认值只能放在 schemaConfig 中。
  readonly: true,
}

const invalidFlatForm: UseFormOptions = {
  // @ts-expect-error useForm 字段默认值只能放在 schemaConfig 中。
  labelWidth: 120,
}

void invalidFlatProvider
void invalidFlatForm

// @ts-expect-error useForm 已合并配置也只能通过第一个参数传入。
useForm<FormValues>(formOptions, config)

// 实例展示状态和受控值不进入共享配置，操作区配置可以继承。
type ComponentOnlyKeys = "modelValue" | "form" | "loading" | "class" | "style"

// 布局组件实现仅在整体配置中声明。
type ComponentImplementationKeys =
  "colComponent" | "rowComponent" | "buttonComponent" | "iconComponent"

/**
 * 使任何不符合边界的属性键成为类型错误。
 * @typeParam TKeys - 应当为空的属性键集合。
 */
type AssertNoKeys<TKeys extends never> = TKeys

// 平铺布局与组件专属字段都只属于 Form Props 的顶层。
type FormTopLevelKeys = ComponentOnlyKeys | "row" | "col"

// 共享整体配置不包含 Form 专属的顶层字段。
export type ComponentOnlyBoundaryCheck = AssertNoKeys<
  Extract<keyof SchemxConfig<FormValues>, FormTopLevelKeys>
>

// 工厂默认配置遵循相同边界。
export type FactoryComponentBoundaryCheck = AssertNoKeys<
  Extract<keyof CreateSchemxOptions<FormValues>, FormTopLevelKeys>
>

// Provider 不接受 Form 专属的顶层字段。
export type ProviderComponentBoundaryCheck = AssertNoKeys<
  Extract<keyof ConfigProviderProps<FormValues>, FormTopLevelKeys>
>

// Core 创建入口不接受 Form 专属的顶层字段。
export type CreationComponentBoundaryCheck = AssertNoKeys<
  Extract<keyof CreateFormOptions<FormValues>, FormTopLevelKeys>
>

// Hook 创建入口不接受 Form 专属的顶层字段。
export type HookComponentBoundaryCheck = AssertNoKeys<
  Extract<keyof UseFormOptions<FormValues>, FormTopLevelKeys>
>

// Form 保留组件专属属性及平铺布局。
export type FormComponentPropsCheck = AssertNoKeys<
  Exclude<FormTopLevelKeys, keyof SchemxFormProps<FormValues>>
>

// schemaConfig 不提供布局或图标组件实现。
export type NestedComponentBoundaryCheck = AssertNoKeys<
  Extract<keyof SchemxSchemaConfig<FormValues>, ComponentImplementationKeys>
>

// 顶层组件配置保留所有实现入口。
export type ComponentImplementationCheck = AssertNoKeys<
  Exclude<ComponentImplementationKeys, keyof SchemxConfig<FormValues>>
>

// Form 仍可局部覆写三个组件实现。
export type FormComponentImplementationCheck = AssertNoKeys<
  Exclude<ComponentImplementationKeys, keyof SchemxFormProps<FormValues>>
>
