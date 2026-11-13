# Release Notes - 2.0.0

## 版本信息

- 目标版本：2.0.0。
- 发布包：`@schemx/vue`。
- 说明更新日期：2026-11-13。
- 发布状态：发布准备中。

适配 Core 2.0 的全局配置与兼容类型移除，保留 Vue 展示配置、Renderer 值与事件及只读字段布局。

- 比较基线：`@schemx/vue@1.2.0`。
- 目标提交：`089dab17e88a8705efe0935a29c4c9e139119ab0`。
- 比较范围：`b15b09818d0634345552f7a89e23627fdfc90abe..089dab17e88a8705efe0935a29c4c9e139119ab0`。

## Important Notices

- 2.0.0 包含公共 API 与 TypeScript 类型的破坏性变更，升级方式见 [Core 2.0 迁移指南](../core/MIGRATION.md)。
- 本说明仅涵盖目标提交中的变更；版本号保留现有发布计划，不代表已经发布。

## Breaking Changes

### Core 透传接口与配置契约调整

根入口透传的 Core API 同步收敛：不再导出 `createField`、`createSignalEffect`、`runSignalUntracked`、`createSignalWatch`、`createDebouncedSignalWatch`、`mergeSchemxConfig`、`mergeAndResolveSchemxConfig` 等旧入口。使用这些高级接口的扩展需改用当前公开状态适配入口或重新评估实现；不要继续依赖旧 Runtime 内部结构。普通字段操作和监听优先使用表单实例及 Vue 的 `useField`、`useWatch` 系列 Hook。

共享配置的字段默认值放入 `schemaConfig`；Form 上仍使用平铺的标签、状态及布局 Props。自定义适配扩展需核对新的 `SchemxConfigDefinition`、`SchemxSchemaConfigDefinition` 和 Renderer 类型契约，具体迁移见 [Core 迁移指南](../core/MIGRATION.md)。

### 样式变量改用语义命名

旧 CSS 变量已移除，不提供兼容别名。自定义主题需迁移：`--schemx-primary-color` → `--schemx-color-primary`，`--schemx-text-color` → `--schemx-color-text-primary`，`--schemx-padding-*` → `--schemx-space-*`，`--schemx-border-radius-*` → `--schemx-radius-*`，`--schemx-font-size-md` → `--schemx-font-size-base`，`--schemx-component-size` → `--schemx-control-height`。

定位提示的背景和描边分别使用 `--schemx-field-highlight-bg`、`--schemx-field-highlight-border-color`；warning/error 使用对应的 `--schemx-color-warning-*` / `--schemx-color-error-*`。标签、错误和分组标题可通过独立的颜色、字号及行高变量调整。完整契约见 [样式变量文档](../../docs/design-tokens.md)。

### 不再透传 Core 模块级全局配置

`@schemx/vue` 根入口不再提供 Core 的模块级 `configureSchemx()` / `getGlobalSchemxConfig()`。普通 Form 和 `useForm()` 不再继承 Core 模块级配置。

将共享配置放在当前 App、ConfigProvider、Form，或使用 Vue 工厂并显式绑定组件：

```ts
import { createFormComponent, createSchemx } from "@schemx/vue"

const api = createSchemx({ schemaConfig: { readonly: true } })
const SchemxForm = createFormComponent(api.createForm)
const defaults = api.getConfig()

api.configureSchemx({ schemaConfig: { readonly: false } })
```

工厂上的 `configureSchemx()` 保留，仅影响后续创建的表单。不同工厂、App 之间的配置不再通过 Core 全局状态传播。

### 透传的 Core Renderer Props 泛型调整

`SchemxBaseComponentProps<TValues, TName, TValue>` 改为 `SchemxBaseComponentProps<TValues>`；特定字段值类型请放入 Renderer 自有 Props。Vue 的值与事件通过框架扩展提供，原有 `SchemxVueBaseComponentProps` 三泛型兼容别名仍保留，但继续建议迁移至推荐类型。

## Features

- 支持 `col: "auto"` 自动列布局，并支持通过 `actionCol` 单独配置操作区布局。
- `scrollToField()` 默认高亮目标字段；可通过 `highlight: false` 关闭，或配置 `duration` 和 `default`、`warning`、`error` 类型。`duration: 0` 持续显示，直至用户操作目标区域、发起新定位或目标失效；高亮不改变校验状态。
- 支持 `buttonComponent` 替换按钮实现，提交和重置按钮通过 `buttonProps` 配置外观，原生提交行为由表单操作区管理。
- 新增 `SchemxSearch` / `schemxSearch` 搜索表单，支持字段折叠及展开，保留提交、重置和公开实例能力。
- 新增 `createSchemx()`、`createFormComponent()` 和 `createSearchComponent()`，可按工厂隔离默认配置与 Registry；组件创建器的可选 `ui` 参数绑定入口主题标识。

## Fixes

- 修正自动列宽度、只读字段标签与内容布局及定位高亮样式。

## Improvements

- Vue 层显式声明 `labelIcon`、`labelAlign`、`labelPosition`、`labelWidth`、`contentAlign`、`colon`、`showRequiredMark`，配合 Core 2.0 保留 Form / Search 的运行时展示 Props 和布尔值继承语义。
- 只读字段的右侧内容、左侧标签布局移至 Vue Field，并同步 Renderer 的 `formItemProps`；内置字段显示效果保持兼容。
- Vue 的展示属性、分组折叠配置、`SchemxColConfig` / `SchemxRowConfig` 继续由框架层提供。Core 删除 `SchemxLayout` 不会删除 Vue 自己的同名兼容别名。

## Documentation

更新 App 配置及 Core 透传 API 说明。完整影响范围和框架适配层迁移方式见 [Core 2.0 迁移指南](../core/MIGRATION.md)。

## Theme Compatibility

公共默认主题不依赖 UI 库。只读值默认使用正文色，禁用样式改用语义文字色；标签通过布局居中，文字行高不再绑定控件高度。
