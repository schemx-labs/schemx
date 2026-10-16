# Release Notes — 1.2.0

## 版本信息

- 目标版本：1.2.0
- 发布包：@schemx/vue
- 生成日期：2026-10-16
- 基准版本：@schemx/vue@1.2.0
- 比较范围：b15b09818d0634345552f7a89e23627fdfc90abe..3281ed42fd90ca5db43a75c0985c42a75c3d09a7
- 目标提交：3281ed4
- 当前分支：dev

新增带 Vue 默认值的配置工厂和完整共享创建选项，调整 Row 与操作区布局，并修复实例配置透传和响应式 Renderer 警告。

## Important Notices

- 版本号沿用目标提交清单，与基准 Tag 版本相同；本文记录该 Tag 之后的已提交变更，正式发布前需确定发布版本。
- 本说明不包含工作区暂存及未提交变更。

## Breaking Changes

<a id="change-6e65737465642d726f772d64656661756c7473"></a>

### 共享 Row 配置移入 schemaConfig

App、`ConfigProvider` 和共享配置中的顶层 `row` 改为 `schemaConfig.row`。不同层的 Row 配置改为整体替换，局部配置不再自动保留低优先级 Row 的属性；Form 组件仍使用平铺的 `row` Prop。

影响范围：使用 App/Provider 顶层 row，或依赖跨层补齐 gutter、align 等 Row 属性的项目需要调整。

#### 迁移说明

1. 将共享配置中的 { row: rowOptions } 改为 { schemaConfig: { row: rowOptions } }；Form 的 :row 保持原用法。
2. 覆盖 Row 时传入需要保留的完整属性；自行合并的配置可使用 mergeConfig(configs, { rowMerge: "inherit" }) 选择属性继承。

<a id="change-616374696f6e2d636f6c756d6e2d6c61796f7574"></a>

### 操作区移入根级 Row 的独立 Col

`.schemx-actions` 从 Form 根元素的直接子节点移入根级 Row 的 Col 中。新增 `actionCol` Prop 控制操作列，默认占满一行且不继承字段的 `col`；提交和重置均隐藏时不创建操作列。

影响范围：依赖操作区旧 DOM 层级的 CSS、DOM 查询和自定义 Row/Col 适配需要调整。

#### 迁移说明

1. 更新依赖 .schemx-actions 为 Form 直接子节点的 CSS 选择器和 DOM 查询。
2. 通过 actionCol 设置操作区的列宽、偏移等布局；不需要单独布局时省略该 Prop。

<a id="change-7368617265642d636f6e6669672d736e617073686f7473"></a>

### 共享配置合并改为冻结快照

`mergeConfig()` 现在返回冻结的共享配置快照，并过滤 `schemas`、`initialValues`、`fieldRules`、生命周期及业务回调。受管的 Schema 配置、Renderer Props、adapter 列表和调度选项会复制并冻结；Registry、组件和其他扩展对象保留引用。

影响范围：直接修改合并结果，或把合并器当作完整表单选项合并器的调用需要调整。

#### 迁移说明

1. 将配置变更作为更高优先级输入重新调用 mergeConfig()，不要直接修改返回快照。
2. 创建表单时保留原始实例选项，例如 createForm({ ...options, ...mergeConfig(options, defaults) })；不要只把共享合并结果传给创建函数。

## Deprecations

### @schemx/vue

<a id="change-6465707265636174652d676c6f62616c2d7265676973747279"></a>

### 弃用模块级配置与 Registry

Vue 透传的 Core 模块级 `configureSchemx()`、`getGlobalSchemxConfig()` 以及 Vue 的 `rendererRegistry`、`presetRuleRegistry` 标记为弃用。需要独立默认值的集成可创建工厂，并显式提供独立 Registry。

#### 迁移说明

1. 需要隔离时分别调用 createRendererRegistry() 和 createPresetRuleRegistry()，再传入 Vue createSchemx()。
2. 在 Vue scope 内使用 useForm(options, schemx.createForm)；组件可通过 App/Provider 显式配置 Registry，或接收已创建的 form。

## Features

### @schemx/vue

- <a id="change-7675652d636f6e6669672d666163746f7279"></a>Vue 根入口新增 `createSchemx()` 和字段默认配置 `defaultConfig`。`useForm(options, creator)` 可接入工厂的 `createForm`，保留每次调用的业务值类型，并由当前 Vue scope 释放表单；适配层还可通过 `provideSchemxFormRuntime()` 绑定内层 Form 的创建器。工厂专属类型从 `@schemx/core` 导入。（影响范围：直接调用工厂 createForm() 时由调用方销毁实例；默认 Registry 的共享限制见 Known Issues。）

- <a id="change-7368617265642d706572666f726d616e63652d6f7074696f6e73"></a>App 安装配置和 `ConfigProvider` 新增 `debug`、`schedulerOptions`、`validationConcurrency` 支持，并统一过滤实例数据、生命周期及业务回调。无参数安装 Form 只注册组件，保留已有 App 配置；共享性能选项只影响新创建的表单。根入口新增 `provideSchemxAppConfig`。

## Fixes

### @schemx/vue

- <a id="change-666f72776172642d666f726d2d72756e74696d652d6f7074696f6e73"></a>Form 内部创建实例时，现在透传 `onRuleError`、`lifecycleHooks` 和调试选项，规则异常消息与挂载、卸载回调可按组件 Props 生效。外部传入的 Form 保留原有回调和生命周期所有权。

- <a id="change-72656163746976652d72656e64657265722d7761726e696e67"></a>Field 渲染响应式 Registry 中的组件时还原原始组件定义，避免 Vue 组件代理警告，同时保留值和事件绑定。

- <a id="change-6173796e632d76616c69646174696f6e2d63616e63656c6c6174696f6e"></a>重置、销毁或新一轮校验接管时，旧调用会及时返回 `cancelled: true`，即使旧规则没有响应 `AbortSignal`。旧轮次停止派发后续字段，晚到结果或拒绝不会覆盖新错误状态，取消的提交也不会触发成功或失败业务回调。

- <a id="change-70656e64696e672d6572726f722d707265736572766174696f6e"></a>表单因 pending 字段阻止校验或提交时，保留此前的外部错误、校验错误和配置错误。重复检查只替换本次 pending 提示；异步校验期间新出现的 pending 也会阻止提交。

## Improvements

### @schemx/vue

- <a id="change-737461626c652d646973706c61792d64656661756c7473"></a>内部 Form 的 Provider/Props 展示更新按字段同步，撤销覆盖时回退到创建时捕获的工厂默认值；对象和数组的嵌套修改仍能触发更新，其他标量变化不会重复提交无关字段。

- <a id="change-67656e657269632d7675652d64656661756c7473"></a>Form Props、`ConfigProviderProps`、Form Context 及 Row/Col 默认配置关联同一 `TValues`，必填判断和布局扩展回调可正确检查字段类型。Field 的 `getValues()` 同时获得上游可写副本类型。

## API Changes

- [共享 Row 配置移入 schemaConfig](#change-6e65737465642d726f772d64656661756c7473)
- [操作区移入根级 Row 的独立 Col](#change-616374696f6e2d636f6c756d6e2d6c61796f7574)
- [共享配置合并改为冻结快照](#change-7368617265642d636f6e6669672d736e617073686f7473)
- [新增 Vue 默认配置工厂与创建器接入](#change-7675652d636f6e6669672d666163746f7279)
- [App 与 Provider 支持完整共享创建选项](#change-7368617265642d706572666f726d616e63652d6f7074696f6e73)
- [内部 Form 正确接收规则错误与生命周期配置](#change-666f72776172642d666f726d2d72756e74696d652d6f7074696f6e73)
- [弃用模块级配置与 Registry](#change-6465707265636174652d676c6f62616c2d7265676973747279)

## TypeScript Changes

- [共享 Row 配置移入 schemaConfig](#change-6e65737465642d726f772d64656661756c7473)
- [新增 Vue 默认配置工厂与创建器接入](#change-7675652d636f6e6669672d666163746f7279)
- [Vue 配置与上下文保留业务值类型](#change-67656e657269632d7675652d64656661756c7473)

## Validation

- 项目测试与构建：跳过 — 本次仅更新发布说明，未运行目标提交的项目测试或构建。

## Known Issues

- Vue createSchemx() 未显式提供 Registry 时，多个工厂复用 Vue 模块级 Renderer 与预设规则 Registry，注册变更会互相可见。 (影响范围：需要在多个 Vue 工厂之间隔离 Renderer 或预设规则的集成) — 临时方案：为每个工厂分别创建并显式传入 rendererRegistry 和 presetRuleRegistry。
- 普通 useForm() 以及未绑定创建器的 Form 未自动补入 Vue 模块级 Registry；未显式配置时可能读取 Core 全局 Registry，或使用新建的空 Registry。 (影响范围：依赖 Vue 模块级默认注册表的表单) — 临时方案：通过表单选项或 App/ConfigProvider 显式传入所需 Registry，或通过 useForm(options, schemx.createForm) 接入已配置的工厂。

## Affected Packages

- @schemx/vue
