import type * as UiApi from "../../index"

// @ts-expect-error UI 包不公开框架工厂。
export type HiddenFactory = typeof UiApi.createSchemx
// @ts-expect-error UI 包不公开工厂返回类型。
export type HiddenFactoryApi = UiApi.SchemxApi
// @ts-expect-error UI 包不公开工厂配置覆盖层类型。
export type HiddenFactoryConfig = UiApi.SchemxConfigureOptions

// @ts-expect-error UI 包不公开框架组件接入函数。
export type HiddenIntegration = typeof UiApi.provideSchemxFormRuntime

// @ts-expect-error UI 包不命名导出工厂配置类型。
export type HiddenFactoryOptions = UiApi.CreateSchemxOptions

// @ts-expect-error UI 旧 getter 已移除，使用 getConfig。
export type RemovedGlobalGetter = typeof UiApi.getGlobalSchemxConfig
// @ts-expect-error UI 旧合并别名已移除，使用 mergeConfig。
export type RemovedMergeAlias = typeof UiApi.mergeSchemxConfig
// @ts-expect-error UI 旧上下文入口已移除，使用 provideFormContext。
export type RemovedFormContext = typeof UiApi.createFormContext
// @ts-expect-error UI 旧配置上下文入口已移除，使用 provideFormContext。
export type RemovedFormConfigContext = typeof UiApi.createFormConfigContext
// @ts-expect-error UI 旧布局类型已移除，使用 SchemxColConfig。
export type RemovedLayoutAlias = UiApi.SchemxLayout
