# Release Notes — 1.1.2

## 版本信息

- 目标版本：1.1.2
- 发布包：@schemx/vant
- 生成日期：2026-10-16
- 基准版本：@schemx/vant@1.1.2
- 比较范围：4d1f389e655ee5e0201d2f0f459046efb1ce6f09..3281ed42fd90ca5db43a75c0985c42a75c3d09a7
- 目标提交：3281ed4
- 当前分支：dev

Vant 的表单与创建入口改用包级默认配置和 Registry，移除旧兼容导出，并接入上游配置、布局与异步校验改进。

## Important Notices

- 版本号沿用目标提交清单，与基准 Tag 版本相同；本文记录该 Tag 之后的已提交变更，正式发布前需确定发布版本。
- 本说明不包含工作区暂存及未提交变更。

## Breaking Changes

<a id="change-72656d6f7665642d6c65676163792d75692d6578706f727473"></a>

### 移除旧配置、上下文与布局导出

Vant 根入口移除 `getGlobalSchemxConfig`、`mergeSchemxConfig`、`createFormContext`、`createFormConfigContext` 和 `SchemxLayout`，改用包级配置读取与统一表单上下文。

#### 迁移说明

1. 将 getGlobalSchemxConfig 改为 Vant 根入口的 getConfig，将 mergeSchemxConfig 改为 mergeConfig。
2. 在 setup 中用 provideFormContext({ form, schemaConfig }) 一次提供实例与展示配置，替代分开的 createFormContext 和 createFormConfigContext。
3. 将 SchemxLayout 类型改为 SchemxColConfig。

<a id="change-7061636b6167652d73636f7065642d75692d64656661756c7473"></a>

### Vant 默认配置改为包级实例

导入 Vant 不再改写 Core 全局配置或 Vue 的 Registry。Vant 的 Form、`createForm` 和 `useForm` 使用本包默认值与独立 Registry；`configureSchemx()` 改为替换本包的业务覆盖层，无参数恢复 Vant 基线，仅影响新表单。

影响范围：只导入 Vant 后继续使用 Vue/Core 创建入口，或依赖 Core 全局配置影响 Vant 的项目需要调整；同一 Vant 包实例内的默认配置仍共享。

#### 迁移说明

1. 让 Vant 表单的组件、createForm、useForm 和 configureSchemx 从 @schemx/vant 导入。
2. 原来依赖 import Vant 的全局副作用时，改用 Vant 入口，或显式把 Vant 的 defaultConfig 传入 Vue createSchemx(defaultConfig)。
3. 通过导出的 Registry 修改注册内容；configureSchemx() 不再接受 Registry 键，单个表单仍可通过选项覆盖 Registry。
4. 跨 App/请求的配置使用 App 安装选项或 ConfigProvider；它们使用普通 Vue 配置上下文，同一子树的其他 UI Form 也会读取该上下文。

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

## Features

### @schemx/vant

- <a id="change-7265757361626c652d76616e742d636f6e666967"></a>新增 `defaultConfig` 和 `getConfig()`，可读取或复用 Vant 的 Renderer、布局组件和字段默认值。局部组件、Hook 与直接创建入口均自动携带 Vant 默认配置，无需先安装插件；App/Provider 配置优先于包默认值。

- <a id="change-76616e742d7368617265642d706572666f726d616e63652d6f7074696f6e73"></a>Vant 的包级默认值、App 安装配置、`ConfigProvider` 和表单局部选项统一支持 `debug`、`schedulerOptions`、`validationConcurrency`。`debug: false` 可覆盖继承值，调度对象整体替换；已创建实例不会因共享性能配置更新而重建。

## Fixes

### @schemx/vant

- <a id="change-6173796e632d76616c69646174696f6e2d63616e63656c6c6174696f6e"></a>重置、销毁或新一轮校验接管时，旧调用会及时返回 `cancelled: true`，即使旧规则没有响应 `AbortSignal`。旧轮次停止派发后续字段，晚到结果或拒绝不会覆盖新错误状态，取消的提交也不会触发成功或失败业务回调。

- <a id="change-70656e64696e672d6572726f722d707265736572766174696f6e"></a>表单因 pending 字段阻止校验或提交时，保留此前的外部错误、校验错误和配置错误。重复检查只替换本次 pending 提示；异步校验期间新出现的 pending 也会阻止提交。

- <a id="change-76616e742d7675652d72756e74696d652d6669786573"></a>Vant 内部 Form 现在正确透传 `onRuleError` 和 `lifecycleHooks`；响应式 Registry 中的 Renderer 不再产生组件代理警告。Provider/Props 的展示更新以创建时默认值为基线，外部 Form 的原回调与销毁责任继续由创建者持有。

## Improvements

### @schemx/vant

- <a id="change-76616e742d67656e657269632d7479706573"></a>Vant 的 Form 和 `useForm` 保留业务字段值类型，嵌套 `required` 及 Renderer Props 回调得到相应类型检查，并继承上游 `getValues()` 的可写副本类型。

- <a id="change-746578742d646f63756d656e742d666c6f77"></a>TextRenderer 容器移除自身的 flex 与垂直居中样式，多行文本及自定义块级内容按普通文档流布局。

## API Changes

- [移除旧配置、上下文与布局导出](#change-72656d6f7665642d6c65676163792d75692d6578706f727473)
- [Vant 默认配置改为包级实例](#change-7061636b6167652d73636f7065642d75692d64656661756c7473)
- [共享 Row 配置移入 schemaConfig](#change-6e65737465642d726f772d64656661756c7473)
- [操作区移入根级 Row 的独立 Col](#change-616374696f6e2d636f6c756d6e2d6c61796f7574)
- [共享配置合并改为冻结快照](#change-7368617265642d636f6e6669672d736e617073686f7473)
- [导出可复用的 Vant 默认配置](#change-7265757361626c652d76616e742d636f6e666967)
- [共享配置支持调试、调度与校验并发](#change-76616e742d7368617265642d706572666f726d616e63652d6f7074696f6e73)

## TypeScript Changes

- [移除旧配置、上下文与布局导出](#change-72656d6f7665642d6c65676163792d75692d6578706f727473)
- [共享 Row 配置移入 schemaConfig](#change-6e65737465642d726f772d64656661756c7473)
- [保留 Vant 表单与默认配置的泛型契约](#change-76616e742d67656e657269632d7479706573)

## Validation

- 项目测试与构建：跳过 — 本次仅更新发布说明，未运行目标提交的项目测试或构建。

## Affected Packages

- @schemx/vant
