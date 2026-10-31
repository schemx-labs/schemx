import {
  createPresetRuleRegistry,
  createRendererRegistry,
  createSchemx,
  mergeConfig,
} from "../../index"

import type {
  CreateFormOptions,
  CreateSchemxOptions,
  FormPerformanceOptions,
  FormRegistryOptions,
  FormSchemaOptions,
  NamePath,
  SchemxApi,
  SchemxConfig,
  SchemxConfigureOptions,
  SchemxInstance,
  Values,
} from "../../index"

// 一个工厂可以创建不同业务值类型的表单。
const api: SchemxApi = createSchemx({ schemaConfig: { labelWidth: 140 } })

const first: SchemxInstance<{ name: string }> = api.createForm({
  initialValues: { name: "A" },
})

const second: SchemxInstance<{ age: number }> = api.createForm({
  initialValues: { age: 10 },
})

first.setFieldValue("name", "B")
second.setFieldValue("age", 20)
// @ts-expect-error 保留字段值类型推导。
first.setFieldValue("name", 12)
// @ts-expect-error 保留路径类型推导。
second.setFieldValue("missing", 20)
// @ts-expect-error 工厂不返回组件。
void api.SchemxForm
// @ts-expect-error 工厂不返回 Provider。
void api.ConfigProvider
// @ts-expect-error 工厂不返回安装函数。
void api.install
// @ts-expect-error 工厂不返回构造器自身。
void api.createSchemx
// @ts-expect-error 实例读取接口统一为 getConfig。
void api.getGlobalSchemxConfig
api.getConfig()
const options = { rendererRegistry: createRendererRegistry() }

// @ts-expect-error Registry 在工厂创建时固定，变量也不能绕过约束。
api.configureSchemx(options)
// @ts-expect-error 配置覆盖层不接受 Registry。
const invalid: SchemxConfigureOptions = { presetRuleRegistry: api.presetRuleRegistry }

// @ts-expect-error 工厂基线不能包含表单实例数据。
createSchemx({ initialValues: { name: "A" } })
void invalid

// 工厂与共享配置使用相同的调试和性能默认值。
const defaults: CreateSchemxOptions = {
  debug: true,
  schedulerOptions: { timeSliceMs: 4 },
  validationConcurrency: 2,
}

createSchemx(defaults)
api.configureSchemx({
  debug: false,
  schedulerOptions: { collectDiagnostics: false },
  validationConcurrency: 1,
})
const debug: boolean | undefined = api.getConfig().debug

const fullOptions: CreateFormOptions = {
  schemas: [],
  initialValues: {},
  fieldRules: {},
  debug: true,
  schedulerOptions: { timeSliceMs: 20 },
}

createSchemx(fullOptions)
// @ts-expect-error 实例回调不属于共享默认值。
createSchemx({ onFinish: () => undefined })
// @ts-expect-error 共享配置读取结果不能直接修改。
api.getConfig().debug = false
void debug

// @ts-expect-error Core 工厂不包含框架 Hook。
void api.useForm

const merged = mergeConfig({
  debug: false,
  schedulerOptions: { timeSliceMs: 20 },
  validationConcurrency: 2,
})

const mergedDebug: boolean | undefined = merged.debug

const mergedConcurrency: number | undefined = merged.validationConcurrency

mergeConfig(fullOptions)
// @ts-expect-error 合并器不接受实例数据字面量。
mergeConfig({ schemas: [] })
// @ts-expect-error 合并结果是只读共享快照。
merged.debug = true
void mergedDebug
void mergedConcurrency

// 模拟后续新增实例选项，验证共享配置不再随实例类型扩张。
declare module "../../index" {
  /**
   * 为创建选项增加仅限当前实例的字段路径。
   * @typeParam TValues - 本次表单值类型。
   * @typeParam TName - 本次允许的字段路径。
   */
  interface CreateFormOptions<
    TValues extends Values = Values,
    TName extends NamePath<TValues> = NamePath<TValues>,
  > {
    /**
     * 仅用于验证实例扩展的隔离和路径推导。
     */
    instanceTypeTestName?: TName
  }
}

/**
 * 同时包含两种字段值，验证共享配置和实例选项的类型关联。
 */
interface ConfigValues {
  /**
   * 文本字段。
   */
  name: string
  /**
   * 数值字段。
   */
  age: number
}

// 所有共享默认值均可直接使用共享配置契约。
const sharedConfig: SchemxConfig<ConfigValues> = {
  schemaConfig: { readonly: true },
  rendererProps: { input: { placeholder: "请输入姓名" } },
  validatorAdapters: [],
  defaultRendererType: "input",
  rendererRegistry: createRendererRegistry(),
  presetRuleRegistry: createPresetRuleRegistry(),
  debug: true,
  schedulerOptions: { timeSliceMs: 4 },
  validationConcurrency: 2,
}

// 工厂入口不增加额外字段，也不丢失共享配置。
const factoryConfig: CreateSchemxOptions<ConfigValues> = sharedConfig

// 工厂配置仍可作为可继承的共享默认值。
const inheritedConfig: SchemxConfig<ConfigValues> = factoryConfig

// Registry 分组从原公开入口导入，保持原有字段。
const registryDefaults: FormRegistryOptions<ConfigValues> = inheritedConfig

// 性能分组从原公开入口导入，保持原有字段。
const performanceDefaults: FormPerformanceOptions = inheritedConfig

// 原有 Schema 分组继续同时接收实例数据和局部默认值。
const schemaDefaults: FormSchemaOptions<ConfigValues> = {
  schemas: [],
  initialValues: { name: "A", age: 18 },
  fieldRules: { name: [] },
  schemaConfig: { disabled: true },
  debug: false,
}

// 创建选项组合共享配置、兼容分组和实例行为，保留两个泛型参数。
const configuredForm: CreateFormOptions<ConfigValues, "name"> = {
  ...sharedConfig,
  ...registryDefaults,
  ...performanceDefaults,
  ...schemaDefaults,
  instanceTypeTestName: "name",
  onFinish: (values) => {
    // 提交回调仍保留具体表单值类型。
    const name: string = values.name

    void name
    // @ts-expect-error 回调不能读取未声明的字段。
    void values.missing
  },
  onFieldsChange: (changedFields) => {
    // 路径回调遵循显式传入的 TName。
    const names: "name"[] = changedFields

    void names
  },
}

mergeConfig(factoryConfig)
mergeConfig(configuredForm)
api.createForm({ ...sharedConfig, ...schemaDefaults })
// @ts-expect-error 自定义路径泛型不能扩大到其他已声明字段。
configuredForm.onFieldsChange?.(["age"], [])
// @ts-expect-error 共享配置字面量不接受实例数据。
const invalidSharedData: SchemxConfig = { initialValues: {} }

// @ts-expect-error 新增实例选项不能进入共享配置。
const invalidSharedExtension: SchemxConfig = { instanceTypeTestName: "name" }

// @ts-expect-error 工厂配置同样不能接收新增实例选项。
createSchemx({ instanceTypeTestName: "name" })
void invalidSharedData
void invalidSharedExtension
