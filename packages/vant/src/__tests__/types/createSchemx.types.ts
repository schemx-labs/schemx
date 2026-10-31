import type * as UiApi from "../../index"

// 透传 Vue 框架工厂，不绑定本包默认配置。
export type VueFactory = typeof UiApi.createSchemx
// 工厂类型经 Vue 根入口透传。
export type FactoryApi = UiApi.SchemxApi
// 工厂覆盖层类型经 Vue 根入口透传。
export type FactoryConfig = UiApi.SchemxConfigureOptions

// @ts-expect-error UI 包不公开框架组件接入函数。
export type HiddenIntegration = typeof UiApi.provideSchemxFormRuntime

// 工厂配置类型经 Vue 根入口透传。
export type FactoryOptions = UiApi.CreateSchemxOptions

// 旧 getter 与 Vue 根入口保持一致，推荐使用本包 getConfig。
export type DeprecatedGlobalGetter = typeof UiApi.getGlobalSchemxConfig
// @ts-expect-error Core 已移除旧合并别名，上层包不再透传。
export type DeprecatedMergeAlias = typeof UiApi.mergeSchemxConfig
// 旧上下文保持导出以兼容已发布 API。
export type DeprecatedFormContext = typeof UiApi.createFormContext
// 旧配置上下文保持导出以兼容已发布 API。
export type DeprecatedFormConfigContext = typeof UiApi.createFormConfigContext
// 旧布局类型与 Vue 根入口保持一致，推荐使用 SchemxColConfig。
export type DeprecatedLayoutAlias = UiApi.SchemxLayout
