import { mergeCreateFormOptions } from "../../form/options"
import {
  createForm,
  mergeConfig,
  mergeSchemxConfig,
  resolveSchemxConfig,
} from "../../index"

import type {
  CreateFormOptions,
  MergeConfigOptions,
  SchedulerIdleOptions,
  SchedulerTrackOptions,
  SchemxConfig,
  SchemxConfigSnapshot,
  SchemxRendererPropsMap,
  SchemxSchemaConfig,
  Values,
} from "../../index"

// 从公共入口扩展两个独立配置层，验证重导出仍支持声明合并。
declare module "../../index" {
  interface SchemxConfigDefinition<TValues extends Values = Values> {
    readonly configTypeTestValues?: TValues
  }

  interface SchemxSchemaConfigDefinition {
    schemaTypeTestMeta?: string
  }
}

// 默认值扩展既接收又返回 TValues，防止解析回退隐式退化为 Values。
declare module "../../index" {
  interface SchemxSchemaConfigDefinition<TValues extends Values = Values> {
    schemaTypeTestCallback?: (values: TValues) => TValues
  }
}

// 配置顶层扩展保留当前表单值类型，字段默认值扩展只出现在 schemaConfig 中。
const extendedConfig: SchemxConfig<{ name: string }> = {
  configTypeTestValues: { name: "姓名" },
  schemaConfig: { schemaTypeTestMeta: "字段默认值" },
}

// 顶层扩展的泛型不能退化为通用 Values。
const invalidExtendedConfig: SchemxConfig<{ name: string }> = {
  // @ts-expect-error 顶层扩展保留 name 的字符串类型。
  configTypeTestValues: { name: 1 },
}

// 字段默认值扩展不允许出现在整体配置顶层。
const invalidTopLevelConfig: SchemxConfig = {
  // @ts-expect-error 字段默认值扩展仅属于 schemaConfig。
  schemaTypeTestMeta: "字段默认值",
}

// 整体配置扩展不允许出现在字段默认值中。
const invalidSchemaConfig: SchemxSchemaConfig = {
  // @ts-expect-error 整体配置扩展仅属于配置顶层。
  configTypeTestValues: { name: "姓名" },
}

const rendererProps: SchemxRendererPropsMap = {
  custom: {
    disabled: true,
    placeholder: "请输入",
  },
}

const config: SchemxConfig = { rendererProps }

const invalidValue: SchemxRendererPropsMap = {
  custom: {
    // @ts-expect-error value 由 Runtime 注入，不能配置为 Renderer 默认值。
    value: "默认值",
  },
}

const invalidValueUpdate: SchemxRendererPropsMap = {
  custom: {
    // @ts-expect-error onUpdate:value 由 Runtime 注入，不能配置为 Renderer 默认值。
    "onUpdate:value": () => {},
  },
}

const invalidFormInstance: SchemxRendererPropsMap = {
  custom: {
    // @ts-expect-error formInstance 由 Runtime 注入，不能配置为 Renderer 默认值。
    formInstance: undefined,
  },
}

const invalidFormItemProps: SchemxRendererPropsMap = {
  custom: {
    // @ts-expect-error formItemProps 由 Runtime 注入，不能配置为 Renderer 默认值。
    formItemProps: undefined,
  },
}

void config
void invalidValue
void invalidValueUpdate
void invalidFormInstance
void invalidFormItemProps
void extendedConfig
void invalidExtendedConfig
void invalidTopLevelConfig
void invalidSchemaConfig

// Core 基础默认值不依赖框架扩展，并保留必填判断的字段值类型。
const coreDefaults: SchemxConfig<{ name: string }> = {
  schemaConfig: {
    readonly: true,
    disabled: false,
    visible: true,
    validationTrigger: ["blur", "change"],
    required: { isEmpty: (value) => !value?.trim() },
  },
}

const coreFormOptions: CreateFormOptions<{ name: string }> = coreDefaults

const mergeOptions: MergeConfigOptions = {
  rowMerge: "inherit",
}

mergeOptions.rowMerge = "replace"

// 空闲等待选项允许在调用前逐步组装。
const idleOptions: SchedulerIdleOptions = {}

idleOptions.timeout = 50
idleOptions.includeIdle = false

// 跟踪选项允许在调用前选择任务优先级。
const trackOptions: SchedulerTrackOptions = {}

trackOptions.priority = "idle"

void idleOptions
void trackOptions

const arrayConfig = mergeConfig<{ name: string }>([coreDefaults], mergeOptions)

const legacyConfig = mergeSchemxConfig<{ name: string }>(coreDefaults)

const resolvedConfig = resolveSchemxConfig(arrayConfig)

createForm<{ name: string }>({ ...coreFormOptions, ...resolvedConfig })

// @ts-expect-error 已合并配置也必须通过第一个参数传入。
createForm<{ name: string }>(coreFormOptions, resolvedConfig)
// 内部配置装配边界显式接收继承配置。
mergeCreateFormOptions(coreFormOptions, resolvedConfig)

const invalidCoreRequired: SchemxConfig<{ age: number }> = {
  schemaConfig: {
    required: {
      isEmpty: (value) => {
        // @ts-expect-error 数值字段不能按字符串处理。
        return !value?.trim()
      },
    },
  },
}

void coreFormOptions
void legacyConfig
void invalidCoreRequired

// 混合字段值形成一个联合参数，调用方必须先收窄。
const mixedDefaults: SchemxSchemaConfig<{ name: string; age: number }> = {
  required: {
    isEmpty: (value) => value == null || (typeof value === "string" && !value.trim()),
  },
}

const typedForm = createForm<{ name: string }>({
  schemaConfig: coreDefaults.schemaConfig,
})

typedForm.updateSchemaConfig({ required: { isEmpty: (value) => !value?.trim() } })

const invalidFlatConfig: SchemxConfig = {
  // @ts-expect-error 字段默认值只能放在 schemaConfig 中。
  readonly: true,
}

void mixedDefaults
void invalidFlatConfig

// 默认配置回调保留当前表单值类型。
const genericDefaults: SchemxSchemaConfig<{ name: string }> = {
  schemaTypeTestCallback: (values) => {
    const name: string = values.name

    // @ts-expect-error 默认配置回调不能访问未声明的字段。
    void values.missing

    return { name }
  },
}

void genericDefaults

// 已标注配置在变参和只读数组调用中均保留 TValues 推导。
const inferredConfig = mergeConfig(coreDefaults, extendedConfig)

const inferredArrayConfig = mergeConfig([coreDefaults, extendedConfig] as const, {
  rowMerge: "inherit",
})

const inferredName: string | undefined = inferredConfig.configTypeTestValues?.name

const inferredArrayName: string | undefined =
  inferredArrayConfig.configTypeTestValues?.name

// @ts-expect-error 推导结果不能将字符串字段退化为任意类型。
const invalidInferredName: number | undefined = inferredConfig.configTypeTestValues?.name

// @ts-expect-error 数组调用也必须保留默认配置回调的值类型。
inferredArrayConfig.schemaConfig?.schemaTypeTestCallback?.({ name: 1 })

// 显式泛型为 Schema 与 Renderer 回调提供相同的字段值上下文。
const explicitConfig = mergeConfig<{ name: string }>({
  schemaConfig: {
    schemaTypeTestCallback: (values) => {
      values.name.toUpperCase()
      // @ts-expect-error 回调不能访问未声明的字段。
      void values.missing

      return values
    },
  },
  rendererProps: {
    custom: {
      onChange: (value) => {
        value?.toUpperCase()
        // @ts-expect-error Renderer 回调接收字符串字段值。
        value?.toFixed()
      },
    },
  },
})

// 快照类型可从公共入口导入，且继续兼容表单创建选项。
const snapshot: SchemxConfigSnapshot<{ name: string }> = explicitConfig

createForm<{ name: string }>(snapshot)

if (snapshot.schemaConfig !== undefined) {
  // @ts-expect-error Schema 默认值所在层级已被冻结。
  snapshot.schemaConfig.readonly = false

  if (Array.isArray(snapshot.schemaConfig.validationTrigger)) {
    // 属性引用的数组未被冻结，仍允许按原类型修改。
    snapshot.schemaConfig.validationTrigger.push("blur")
  }
}

if (snapshot.rendererProps !== undefined) {
  // @ts-expect-error Renderer Map 已被冻结。
  snapshot.rendererProps.custom = {}

  if (snapshot.rendererProps.custom !== undefined) {
    // @ts-expect-error 每个 Renderer 的 Props 对象已被冻结。
    snapshot.rendererProps.custom.disabled = false
  }
}

if (inferredConfig.configTypeTestValues !== undefined) {
  // 共享扩展对象保留引用及可变语义，不递归标记只读。
  inferredConfig.configTypeTestValues.name = "更新值"
}

// @ts-expect-error 配置变参后不能追加数组调用专用的合并策略。
mergeConfig(coreDefaults, { rowMerge: "inherit" })

void inferredName
void inferredArrayName
void invalidInferredName
