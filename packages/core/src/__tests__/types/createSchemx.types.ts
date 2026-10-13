import { createRendererRegistry, createSchemx, mergeConfig } from "../../index"

import type {
  CreateFormOptions,
  CreateSchemxOptions,
  SchemxApi,
  SchemxConfigureOptions,
  SchemxInstance,
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

// 三项新默认值与 Vue 布局扩展共享同一个配置契约。
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
  schedulerOptions: { idleTimeout: 20 },
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
  schedulerOptions: { idleTimeout: 20 },
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
