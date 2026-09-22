# Release Notes — 1.0.1

## 版本信息

- 目标版本：1.0.1
- 发布包：@schemx/vue
- 生成日期：2026-09-23
- 基准版本：@schemx/vue@1.0.1
- 比较范围：13c230bee8254718e8137166cf349b0570ad0759..333ac2b9f85bf4d62800cfb04f6b00e8fc3e2fad
- 目标提交：333ac2b
- 当前分支：dev

新增 Row、Icon 与 24 栅格布局能力，并统一 App 插件、ConfigProvider 和 Form 的布局配置入口。

## Breaking Changes

<a id="change-72656d6f76652d72656769737465722d636f6c"></a>

### 移除 `registerCol` 全局注册函数 (@schemx/vue)

Vue 根入口不再导出 `registerCol`；Col 组件现在从 Form、App 插件配置或 ConfigProvider 的 `colComponent` 读取实现。

影响范围：通过 `registerCol(component)` 设置全局列组件的调用方。

#### 迁移说明

影响范围：调用 `registerCol(component)` 的应用。

1. 在插件安装时传入 `app.use(SchemxForm, { colComponent: component })`，或在 `ConfigProvider`/Form 上设置 `colComponent`。

<a id="change-6669656c642d736c6f742d626f756e64617279"></a>

### 字段整体插槽的替换范围调整 (@schemx/vue)

字段 `{name}` 整体插槽现在只替换标签和控件主体，Before、Error、After 区域仍由字段 wrapper 渲染；此前通过整体插槽一并接管这些区域的实现可能出现重复内容或布局变化。

影响范围：在 `{name}` 插槽中自行渲染 Before、Error 或 After 内容的调用方。

#### 迁移说明

影响范围：使用字段整体插槽并自行控制 Before、Error、After 区域的实现。

1. 将 Before、Error、After 内容迁移到对应的 `{name}Before`、`{name}Error`、`{name}After` 命名插槽。
2. 让 `{name}` 插槽只负责标签和控件主体。

## Features

### @schemx/vue

- <a id="change-7675652d6c61796f75742d616e642d69636f6e2d636f6d706f6e656e7473"></a>根入口新增 `Row`、`Icon` 及 `SchemxRowConfig`、`SchemxColConfig`；Vue 提供默认 flex 行列布局，并支持配置 gutter、Row/Col 组件和图标适配组件。`labelIcon` 现在可使用字符串或 Vue 组件。（影响范围：使用 Vue 表单布局、标签图标或自定义组件库适配的调用方。）

## API Changes

- [移除 `registerCol` 全局注册函数](#change-72656d6f76652d72656769737465722d636f6c) (@schemx/vue)
- [字段整体插槽的替换范围调整](#change-6669656c642d736c6f742d626f756e64617279) (@schemx/vue)
- [新增 Row、Icon 与栅格布局配置](#change-7675652d6c61796f75742d616e642d69636f6e2d636f6d706f6e656e7473) (@schemx/vue)

## TypeScript Changes

- [新增 Row、Icon 与栅格布局配置](#change-7675652d6c61796f75742d616e642d69636f6e2d636f6d706f6e656e7473) (@schemx/vue)

## Affected Packages

- @schemx/vue
