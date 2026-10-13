import * as VueApi from "../../index"

import type { ConfigProviderProps, SchemxInstallOptions } from "../../index"
import type { CreateSchemxOptions, SchemxInstance } from "@schemx/core"

const defaults: CreateSchemxOptions = {
  debug: true,
  colComponent: undefined,
}

const api = VueApi.createSchemx(defaults)

const first: SchemxInstance<{ name: string }> = VueApi.useForm(
  { initialValues: { name: "A" } },
  api.createForm
)

const second: SchemxInstance<{ age: number }> = VueApi.useForm(
  { initialValues: { age: 10 } },
  api.createForm
)

first.setFieldValue("name", "B")
second.setFieldValue("age", 20)
// @ts-expect-error 保留字段值推导。
first.setFieldValue("name", 12)
// @ts-expect-error 保留字段路径推导。
second.setFieldValue("missing", 20)
api.createForm({ colComponent: defaults.colComponent, initialValues: { name: "A" } })
VueApi.provideSchemxFormRuntime(api.createForm)
const providerDefaults: ConfigProviderProps = defaults

const installDefaults: SchemxInstallOptions = defaults

export type VueFactory = typeof VueApi.createSchemx
// @ts-expect-error 工厂类型只从 Core 导出。
export type HiddenFactoryApi = VueApi.SchemxApi
// @ts-expect-error 工厂配置类型只从 Core 导出。
export type HiddenFactoryOptions = VueApi.CreateSchemxOptions
// @ts-expect-error 工厂更新类型只从 Core 导出。
export type HiddenConfigureOptions = VueApi.SchemxConfigureOptions
// @ts-expect-error 普通上下文不接受工厂作用域。
VueApi.useConfigProviderContext(api)
void providerDefaults
void installDefaults

// @ts-expect-error Vue 工厂仍不提供组件或 Hook。
void api.useForm
// @ts-expect-error Vue 工厂保留共享配置的实例数据限制。
VueApi.createSchemx({ initialValues: { name: "A" } })
