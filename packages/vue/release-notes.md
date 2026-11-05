# Release Notes - 2.0.0

## 版本信息

- 目标版本：2.0.0。
- 发布包：`@schemx/vue`。
- 说明更新日期：2026-11-05。
- 发布状态：发布准备中。

适配 Core 2.0 的全局配置与兼容类型移除，保留 Vue 展示配置、Renderer 值与事件及只读字段布局。

## Important Notices

- 2.0.0 包含公共 API 与 TypeScript 类型的破坏性变更，升级方式见 [Core 2.0 迁移指南](../core/MIGRATION.md)。
- 本说明面向即将发布的 2.0.0，包含此前确认纳入的暂存变更；正式发布操作尚未执行。

## Breaking Changes

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

## Improvements

- Vue 层显式声明 `labelIcon`、`labelAlign`、`labelPosition`、`labelWidth`、`contentAlign`、`colon`、`showRequiredMark`，配合 Core 2.0 保留 Form / Search 的运行时展示 Props 和布尔值继承语义。
- 只读字段的右侧内容、左侧标签布局移至 Vue Field，并同步 Renderer 的 `formItemProps`；内置字段显示效果保持兼容。
- Vue 的展示属性、分组折叠配置、`SchemxColConfig` / `SchemxRowConfig` 继续由框架层提供。Core 删除 `SchemxLayout` 不会删除 Vue 自己的同名兼容别名。

## Documentation

更新 App 配置及 Core 透传 API 说明。完整影响范围和框架适配层迁移方式见 [Core 2.0 迁移指南](../core/MIGRATION.md)。

## Validation

本包 315 项测试通过，相关类型检查与构建通过。
