# Release Notes — 1.0.0-next.4

## 版本信息

- 目标版本：1.0.0-next.4
- 发布包：@schemx/core
- 生成日期：2026-09-04
- 基准版本：@schemx/core@0.2.3
- 比较范围：c9b1d200d09002498b902dd96f8ec84d61cd21fe..0136a0a47d8daee37019ac3e30bfd701c6b27936
- 目标提交：0136a0a
- 当前分支：dev

本预发布版本完成了 Core 表单运行时、校验和 Schema 契约的大版本重构，并新增动态数组、Signal watch 与 UI 适配器接口。多个公共 API、类型和 Schema 形态不兼容，升级前请先完成下方迁移。

## Important Notices

- `1.0.0-next.4` 是预发布版本，公共 API 仍可能继续调整。

## Breaking Changes

<a id="change-636f72652d76616c69646174696f6e2d726573756c74"></a>

### 统一 ValidationResult 与字段错误 API

`validate`、`validateField`、`submit` 现在统一返回 `ValidationResult`；成功结果提供 `values`，失败结果提供结构化 `errors`，过期运行以 `cancelled: true` 标识。旧的结果类型和单数错误 API 已移除。

影响范围：直接读取旧校验结果字段、单数错误方法或将 `submit()` 当作 `Promise<void>` 使用的调用方。

#### 迁移说明

影响范围：Core 校验调用、提交回调和字段错误读写

1. 将单数错误方法替换为 `getFieldErrors`、`setFieldErrors`、`clearFieldErrors`。
2. 按 `result.valid` 分支读取 `result.values` 或 `result.errors`，忽略 `result.cancelled === true` 的过期结果。
3. 将 `onFinishFailed` 的参数按 `ValidationFailure` 处理。

替代方案：`ValidationResult<TValues>` 与复数错误 API

<a id="change-636f72652d72756c652d7265676973747279"></a>

### 规则注册与第三方校验器接入边界重命名

根入口不再提供旧的 `createValidatorsRegistry` / `ValidatorsRegistryType` 体系；命名规则改由 `PresetRuleRegistry`、`createPresetRuleRegistry` 管理，第三方校验器改通过 `validatorAdapters` 与 `ValidationAdapterV1` 接入。

影响范围：依赖旧规则注册表名称、`validatorRegistry` 配置项或旧第三方规则注册边界的项目。

#### 迁移说明

影响范围：Core 根导出、CreateFormOptions 和表单实例规则方法

1. 将旧 Registry 工厂和类型替换为 `createPresetRuleRegistry` / `PresetRuleRegistry`。
2. 将 `getValidator`、`registerValidator`、`hasValidator` 替换为 `getPresetRule`、`registerPresetRule`、`hasPresetRule`。
3. 第三方规则实现 `ValidationAdapterV1`，并通过 `validatorAdapters` 注册。

替代方案：`PresetRuleRegistry` + `ValidationAdapterV1`

<a id="change-636f72652d7369676e616c2d656666656374"></a>

### 移除 createEffect，统一 Signal effect/watch API

`@schemx/core` 根入口不再导出 `createEffect` 及其旧 Effect 类型，改为公开 `createSignalEffect`、`createSignalWatch`、`createDebouncedSignalWatch` 和 `runSignalUntracked`。

影响范围：直接导入旧 Effect API，或依赖旧 cleanup/debounce effect 返回值的项目。

#### 迁移说明

影响范围：从 `@schemx/core` 导入 `createEffect` 的代码

1. 将无回调监听替换为 `createSignalEffect`，并保留返回的 disposer。
2. 需要 source/callback 或防抖控制时改用 `createSignalWatch` 或 `createDebouncedSignalWatch`。
3. Vue 组件中将 disposer 交给 `onUnmounted`，或改用 `useWatch`。

替代方案：`createSignalEffect`、`createSignalWatch`、`createDebouncedSignalWatch`

<a id="change-636f72652d666f726d2d636f6e6669672d626f756e64617279"></a>

### 表单配置与框架层 Props 边界重构

旧的平铺 `SchemxProps` / `SchemxDefaultProps` 和 `updateDefaultProps` 不再是当前公共契约；`createForm` 配置拆分为 `schemaConfig`、Renderer/Registry、回调、生命周期和性能选项，实例方法使用 `updateSchemaConfig`。

影响范围：在 `createForm` 或封装层传入平铺展示配置、读取旧配置类型或调用 `updateDefaultProps` 的项目。

#### 迁移说明

影响范围：createForm 选项、SchemxInstance 配置更新和根类型导出

1. 将 `createForm({ readonly, disabled, ... })` 改为 `createForm({ schemaConfig: { readonly, disabled, ... } })`。
2. 将 `updateDefaultProps(partial)` 改为 `updateSchemaConfig(partial)`。
3. 按 `FormSchemaOptions`、`FormRegistryOptions`、`FormCallbackOptions`、`FormLifecycleOptions` 和 `FormPerformanceOptions` 组合类型。

替代方案：`schemaConfig` + 分组后的 `CreateFormOptions`

<a id="change-636f72652d636f6e7461696e65722d736368656d612d636f6e7472616374"></a>

### Group 与 Dependency Schema 契约改为结构识别

Group 不再使用 `componentType: "group"`，Dependency 不再使用 `componentType: "dependency"`；当前分别由 `children` 和 `to` + `renderer` 结构识别。容器同时支持 visible、readonly、disabled、折叠和动态依赖状态。

影响范围：直接构造旧 Group/Dependency Schema，或依赖旧 `componentType` 判别逻辑的项目。

#### 迁移说明

影响范围：原始 Schema、Schema 类型守卫和容器运行时

1. 移除 Group 的 `componentType: "group"`，保留 `label` 与 `children`。
2. 移除 Dependency 的 `componentType: "dependency"`，使用 `to`、`renderer` 和容器状态。
3. 按 `collapsible`、`collapsed` 与 `destroyOnCollapse` 重新配置折叠行为。

替代方案：`children` Group 与 `to`/`renderer` Dependency Schema

<a id="change-636f72652d6669656c642d636f6e74726f6c6c65722d636f6e7472616374"></a>

### 字段控制器快照与状态 API 调整

`SchemxFieldInstance.getSnapshot()` 现在返回当前字段快照，完整表单快照改用 `getSnapshots()`；同时新增 `setTouched()`，字段规则和校验方法与新的 SchemxInstance 契约保持一致。

影响范围：依赖 `getSnapshot()` 返回完整表单值，或使用旧字段状态/规则方法的适配层。

#### 迁移说明

影响范围：createField 返回的字段控制器

1. 需要完整表单快照时将 `getSnapshot()` 改为 `getSnapshots()`。
2. 按新的 `getErrors`、`setErrors`、`clearErrors`、`setRules` 和 `removeRules` 方法迁移字段级调用。
3. 需要手动同步交互状态时使用 `setTouched(value)`。

替代方案：`getSnapshot`（字段）+ `getSnapshots`（表单）

## Features

### @schemx/core

- <a id="change-636f72652d64796e616d69632d617272617973"></a>Core 新增 `SchemxDynamicField`、`FieldArrayPath` 与 `SchemxDynamicArrayPath`，按对象数组创建和复用行级运行时节点；Dynamic 行内可继续使用 Group、Dependency 和相对字段路径。

- <a id="change-636f72652d7369676e616c2d7761746368"></a>`createSignalWatch` 和 `createDebouncedSignalWatch` 支持 immediate、once、相等性判断、等待时间及 run/cancel/flush/dispose 控制。

- <a id="change-636f72652d75692d61646170746572"></a>`@schemx/core/adapter` 新增 `createFormStateAdapter()` 及 Snapshot/State Adapter 类型，为框架层提供稳定快照和按需订阅协议。

- <a id="change-636f72652d72656e64657265722d64656661756c742d636f6e666967"></a>新增 `configureSchemx`、配置合并/解析 API、`rendererProps` 和 `fieldRules`；表单显式配置、全局配置、Registry 与字段配置按固定优先级合并。

## Fixes

### @schemx/core

- <a id="change-636f72652d70726573657276652d636c65616e7570"></a>字段 `preserve: false` 会在 Schema 或动态子树移除时清理字段值、touched、pending、规则与错误状态；默认仍保留字段值。

- <a id="change-636f72652d6173796e632d63616e63656c6c6174696f6e"></a>Dependency renderer、字段校验和调度任务支持取消与过期结果抑制；旧请求晚于新请求完成时不会覆盖最新状态，取消结果不会被当作普通校验失败。

## Improvements

### @schemx/core

- <a id="change-636f72652d666f726d2d706572666f726d616e6365"></a>`CreateFormOptions` 新增调度器配置、整表校验并发度和调试选项；Core type-check 同时覆盖公共类型测试。

## Documentation

### @schemx/core

- <a id="change-636f72652d646f63756d656e746174696f6e"></a>Core README 补充校验结果、规则 Registry、配置、容器 Schema、动态数组和表单实例 API 说明。

## API Changes

- [统一 ValidationResult 与字段错误 API](#change-636f72652d76616c69646174696f6e2d726573756c74)
- [规则注册与第三方校验器接入边界重命名](#change-636f72652d72756c652d7265676973747279)
- [移除 createEffect，统一 Signal effect/watch API](#change-636f72652d7369676e616c2d656666656374)
- [表单配置与框架层 Props 边界重构](#change-636f72652d666f726d2d636f6e6669672d626f756e64617279)
- [Group 与 Dependency Schema 契约改为结构识别](#change-636f72652d636f6e7461696e65722d736368656d612d636f6e7472616374)
- [字段控制器快照与状态 API 调整](#change-636f72652d6669656c642d636f6e74726f6c6c65722d636f6e7472616374)
- [新增类型安全的 Dynamic 数组 Schema](#change-636f72652d64796e616d69632d617272617973)
- [新增 Signal watch 与防抖监听](#change-636f72652d7369676e616c2d7761746368)
- [新增 @schemx/core/adapter UI 适配入口](#change-636f72652d75692d61646170746572)
- [扩展全局配置与 Renderer 默认 Props](#change-636f72652d72656e64657265722d64656661756c742d636f6e666967)
- [更新 Core API 与迁移文档](#change-636f72652d646f63756d656e746174696f6e)

## TypeScript Changes

- [统一 ValidationResult 与字段错误 API](#change-636f72652d76616c69646174696f6e2d726573756c74)
- [规则注册与第三方校验器接入边界重命名](#change-636f72652d72756c652d7265676973747279)
- [移除 createEffect，统一 Signal effect/watch API](#change-636f72652d7369676e616c2d656666656374)
- [表单配置与框架层 Props 边界重构](#change-636f72652d666f726d2d636f6e6669672d626f756e64617279)
- [Group 与 Dependency Schema 契约改为结构识别](#change-636f72652d636f6e7461696e65722d736368656d612d636f6e7472616374)
- [字段控制器快照与状态 API 调整](#change-636f72652d6669656c642d636f6e74726f6c6c65722d636f6e7472616374)
- [新增类型安全的 Dynamic 数组 Schema](#change-636f72652d64796e616d69632d617272617973)
- [新增 @schemx/core/adapter UI 适配入口](#change-636f72652d75692d61646170746572)
- [扩展全局配置与 Renderer 默认 Props](#change-636f72652d72656e64657265722d64656661756c742d636f6e666967)
- [补充表单性能与类型检查配置](#change-636f72652d666f726d2d706572666f726d616e6365)
- [Core 公共契约需与适配包同步](#change-636f72652d636f6d70617469626c652d7061636b61676573)

## Dependencies and Compatibility

- <a id="change-636f72652d636f6d70617469626c652d7061636b61676573"></a>本范围同时更新了依赖 Core 类型和适配边界的 `@schemx/vue`、`@schemx/vant` 及校验适配包；升级 Core 时应将相关包作为同一兼容性批次检查。

## Affected Packages

- @schemx/core
