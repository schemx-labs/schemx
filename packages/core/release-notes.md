# Release Notes — 1.1.1

## 版本信息

- 目标版本：1.1.1
- 发布包：@schemx/core
- 生成日期：2026-10-16
- 基准版本：@schemx/core@1.1.1
- 比较范围：18326e882bd63c32e1d0c355cc411847c9eb8775..3281ed42fd90ca5db43a75c0985c42a75c3d09a7
- 目标提交：3281ed4
- 当前分支：dev

新增独立默认配置工厂与创建快照，统一共享配置合并和类型关联，并修复异步校验取消及 pending 错误保留。

## Important Notices

- 版本号沿用目标提交清单，与基准 Tag 版本相同；本文记录该 Tag 之后的已提交变更，正式发布前需确定发布版本。
- 本说明不包含工作区暂存及未提交变更。

## Breaking Changes

<a id="change-7368617265642d636f6e6669672d736e617073686f7473"></a>

### 共享配置合并改为冻结快照

`mergeConfig()` 现在返回冻结的共享配置快照，并过滤 `schemas`、`initialValues`、`fieldRules`、生命周期及业务回调。受管的 Schema 配置、Renderer Props、adapter 列表和调度选项会复制并冻结；Registry、组件和其他扩展对象保留引用。

影响范围：直接修改合并结果，或把合并器当作完整表单选项合并器的调用需要调整。

#### 迁移说明

1. 将配置变更作为更高优先级输入重新调用 mergeConfig()，不要直接修改返回快照。
2. 创建表单时保留原始实例选项，例如 createForm({ ...options, ...mergeConfig(options, defaults) })；不要只把共享合并结果传给创建函数。

## Deprecations

### @schemx/core

<a id="change-6465707265636174652d676c6f62616c2d636f6e666967"></a>

### 弃用模块级全局配置入口

Core 的模块级 `configureSchemx()` 和 `getGlobalSchemxConfig()` 标记为弃用并保留原行为，新代码可使用独立工厂的配置方法。

#### 迁移说明

1. 通过 createSchemx(defaults) 创建默认配置工厂。
2. 使用工厂的 createForm()、configureSchemx() 和 getConfig()；工厂不会读取旧模块级配置。

## Features

### @schemx/core

- <a id="change-69736f6c617465642d636f6e6669672d666163746f7279"></a>新增 `createSchemx(config)`，返回 `createForm`、`configureSchemx`、`getConfig` 和两个 Registry。工厂不读取模块级全局配置；未显式提供 Registry 时创建独立注册表。配置覆盖层每次替换，无参数恢复创建基线；修改只影响后续表单。（影响范围：可按业务模块或请求隔离默认配置；共享默认值支持 debug、schedulerOptions 和 validationConcurrency。Registry 在工厂创建时固定，configureSchemx() 不接受 Registry 键，单个表单仍可局部覆盖。）

- <a id="change-616461707465722d6372656174696f6e2d736e617073686f7473"></a>`@schemx/core/adapter` 新增 `createFormWithConfig(options, config)` 和 `getFormCreationConfig(form)`，以及 `FormCreationSnapshot` 类型。适配层可显式指定继承配置并读取创建时快照，避免后续展示更新重新读取全局默认值。

- <a id="change-726f772d6d657267652d6f7074696f6e73"></a>`mergeConfig()` 新增配置数组调用方式和 `MergeConfigOptions`；通过 `{ rowMerge: "inherit" }` 可对 `schemaConfig.row` 按属性继承，默认仍整体替换。根入口同时新增 `normalizeSchemxConfig` 导出。

## Fixes

### @schemx/core

- <a id="change-6173796e632d76616c69646174696f6e2d63616e63656c6c6174696f6e"></a>重置、销毁或新一轮校验接管时，旧调用会及时返回 `cancelled: true`，即使旧规则没有响应 `AbortSignal`。旧轮次停止派发后续字段，晚到结果或拒绝不会覆盖新错误状态，取消的提交也不会触发成功或失败业务回调。

- <a id="change-70656e64696e672d6572726f722d707265736572766174696f6e"></a>表单因 pending 字段阻止校验或提交时，保留此前的外部错误、校验错误和配置错误。重复检查只替换本次 pending 提示；异步校验期间新出现的 pending 也会阻止提交。

## Improvements

### @schemx/core

- <a id="change-736368656d612d636f6e6669672d72656672657368"></a>`updateSchemaConfig({})` 和无变化的标量更新跳过视图刷新；对象或数组即使沿用相同引用仍会刷新，支持原地修改后显式提交。传入 `undefined` 可清除扩展默认值，Core 内置项恢复其默认值。

- <a id="change-74797065642d736368656d612d64656661756c7473"></a>`SchemxSchemaConfig<TValues>` 及其声明合并扩展现在贯穿配置合并、创建、编译和运行时更新；`required.isEmpty` 等回调保留当前表单字段值类型。

- <a id="change-6d757461626c652d636f70792d7479706573"></a>`SchemxFieldInstance.getValues()` 的返回类型改为可写的 `TValues`，与实际返回独立副本的行为一致。Renderer 注册描述和调度选项可逐步组装；Registry 返回的条目及 Core 管理的上下文引用仍保持只读约束。

## API Changes

- [共享配置合并改为冻结快照](#change-7368617265642d636f6e6669672d736e617073686f7473)
- [新增独立表单默认配置工厂](#change-69736f6c617465642d636f6e6669672d666163746f7279)
- [新增适配层创建与配置快照入口](#change-616461707465722d6372656174696f6e2d736e617073686f7473)
- [配置合并支持数组与 Row 策略](#change-726f772d6d657267652d6f7074696f6e73)
- [默认配置保留表单值泛型](#change-74797065642d736368656d612d64656661756c7473)
- [弃用模块级全局配置入口](#change-6465707265636174652d676c6f62616c2d636f6e666967)

## TypeScript Changes

- [新增独立表单默认配置工厂](#change-69736f6c617465642d636f6e6669672d666163746f7279)
- [新增适配层创建与配置快照入口](#change-616461707465722d6372656174696f6e2d736e617073686f7473)
- [配置合并支持数组与 Row 策略](#change-726f772d6d657267652d6f7074696f6e73)
- [默认配置保留表单值泛型](#change-74797065642d736368656d612d64656661756c7473)
- [放宽调用方输入与值副本的只读限制](#change-6d757461626c652d636f70792d7479706573)

## Validation

- 项目测试与构建：跳过 — 本次仅更新发布说明，未运行目标提交的项目测试或构建。

## Affected Packages

- @schemx/core
