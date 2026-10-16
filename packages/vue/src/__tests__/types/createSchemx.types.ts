import * as VueApi from "../../index"

import type BaseForm from "../../formRuntime.js"
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
const Form = VueApi.createFormComponent(api.createForm)

const GenericForm: typeof BaseForm = Form

void GenericForm
void VueApi.provideSchemxAppConfig

Form<{ name: string }>({
  initialValues: { name: "A" },
  "onUpdate:modelValue": (values) => {
    const name: string = values.name

    void name
    // @ts-expect-error 回调值保留业务类型。
    const invalid: number = values.name

    void invalid
  },
})
Form<{ name: string }>({
  // @ts-expect-error 绑定工厂后的组件仍检查初始字段值。
  initialValues: { name: 12 },
})

// @ts-expect-error 未发布的创建器注入入口已删除。
export type RemovedRuntimeProvider = typeof VueApi.provideSchemxFormRuntime
// App 配置安装函数从 Vue 根入口导出。
export type AppConfigProvider = typeof VueApi.provideSchemxAppConfig
// @ts-expect-error 创建器类型直接从 Core API 读取。
export type HiddenFormCreator = VueApi.FormCreator
const providerDefaults: ConfigProviderProps = defaults

const installDefaults: SchemxInstallOptions = defaults

export type VueFactory = typeof VueApi.createSchemx
// 工厂类型随 Core 公共类型一起透传。
export type FactoryApi = VueApi.SchemxApi
// 工厂配置与 Core 共享同一类型。
export type FactoryOptions = VueApi.CreateSchemxOptions
// 工厂覆盖层类型随 Core 公共类型一起透传。
export type ConfigureOptions = VueApi.SchemxConfigureOptions
// @ts-expect-error 普通上下文不接受工厂作用域。
VueApi.useConfigProviderContext(api)
void providerDefaults
void installDefaults

// @ts-expect-error Vue 工厂仍不提供组件或 Hook。
void api.useForm
// @ts-expect-error Vue 工厂保留共享配置的实例数据限制。
VueApi.createSchemx({ initialValues: { name: "A" } })
