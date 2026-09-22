# Release Notes — 1.0.1

## 版本信息

- 目标版本：1.0.1
- 发布包：@schemx/core
- 生成日期：2026-09-11
- 基准版本：@schemx/core@1.0.0
- 比较范围：9696a15daf708ed8f1438f4cf3324e50019f95b1..a62db33c25a2d43a9a071eec8748f75ad09d477a
- 目标提交：a62db33
- 当前分支：main

1.0.1 在保留 1.0.0 Core 公共类型与配置兼容入口的同时，完善按字段名和 Renderer 的 Schema 类型推导，并为 UI 适配层提供可声明的 Props、配置和动态依赖扩展点。

## Important Notices

- 目标提交尚未创建匹配的 @schemx/core@1.0.1 Tag；目标版本取自目标提交中的 package.json。
- Core、Vue 与 Vant 的公共类型存在交叉依赖，建议同步升级至 1.0.1。

## Breaking Changes

<a id="change-636f72652d616461707465722d747970652d626f756e64617279"></a>

### Core 适配层类型边界调整 (@schemx/core)

Core 将 Renderer 公共 Props、Schema 展示配置和字段依赖的适配层扩展改为声明合并边界；SchemxField 同时按字段名和 componentType 收窄。旧版 SchemxBaseComponentProps 与 UI 默认配置仍保留为兼容入口，但新适配层应使用专属扩展类型。

影响范围：直接实现 UI 适配层、依赖 SchemxComponentProps 的 TypeScript 项目，以及需要字段级 Schema 推导的项目。

#### 迁移说明

影响范围：Core/UI 适配层的 Renderer Props、Schema 配置和动态依赖声明

1. Vue Renderer 从 @schemx/vue 导入 SchemxBaseComponentProps；其他适配层用 SchemxComponentPropsDefinition<TValues> 声明公共 Renderer Props。
2. 用 SchemxSchemaConfigDefinition 声明适配层的表单展示默认值，用 SchemxFieldDependenciesDefinition<TValues> 声明可动态覆盖的展示属性。
3. 升级 @schemx/core、@schemx/vue 和 @schemx/vant 至相同的 1.0.1 版本。

Core 保留已弃用的字符串 `labelIcon` 兼容字段和默认值；Vue 适配层通过声明合并将其类型扩展为 `string | Component`，并管理图标 Adapter 与展示默认值。

## Features

### @schemx/core

- <a id="change-636f72652d616461707465722d657874656e73696f6e2d706f696e7473"></a>新增 SchemxComponentPropsDefinition、SchemxSchemaConfigDefinition 和 SchemxFieldDependenciesDefinition；适配层可声明 Renderer Props、字段展示默认值及依赖动态属性，Core 会在运行时解析这些扩展键。（影响范围：编写 Vue、Vant 或其他 UI 适配层时，可以通过声明合并扩展展示契约，不必让 Core 预先硬编码每个 UI 属性。）

## Fixes

### @schemx/core

- <a id="change-636f72652d726573746f72652d6c65676163792d617069"></a>恢复 SchemxRuntimeInjectedProp、旧版 Renderer Props 字段和 Core UI 默认配置；兼容入口继续可用，并通过弃用标记提示适配层迁移到新的扩展类型。（影响范围：从 1.0.0 升级的 Core 消费方可以继续使用既有 Renderer Props、Runtime 注入字段和标签展示默认配置。）

## Improvements

### @schemx/core

- <a id="change-636f72652d736368656d612d6669656c642d696e666572656e6365"></a>SchemxField 现在同时按字段名和 componentType 分发，rules、required.isEmpty、initialValue 与 onChange 可获得当前字段值类型；createSchemas(schemas) 也会从 Schema 数组提取表单值类型。（影响范围：使用对象值、嵌套字段或自定义 Renderer 的 TypeScript 项目可减少字段值联合误报，并更早发现初始值、规则和回调中的类型错误。）

## Documentation

### @schemx/core

- <a id="change-636f72652d6170692d646f63756d656e746174696f6e"></a>Core README 更新 Schema 值类型推导、Renderer Props、依赖扩展、Schema 配置和 Runtime 边界说明，便于实现自定义适配层和排查类型约束。（影响范围：需要升级 Core 类型体系或实现自定义 UI 适配层的开发者可以按新的公开类型和扩展点调整代码。）

## API Changes

- [Core 适配层类型边界调整](#change-636f72652d616461707465722d747970652d626f756e64617279) (@schemx/core)
- [按字段名和 Renderer 精确推导 Schema 类型](#change-636f72652d736368656d612d6669656c642d696e666572656e6365) (@schemx/core)
- [提供适配层 Props、配置和动态依赖扩展点](#change-636f72652d616461707465722d657874656e73696f6e2d706f696e7473) (@schemx/core)
- [恢复 1.0.0 Core 公共类型与默认配置](#change-636f72652d726573746f72652d6c65676163792d617069) (@schemx/core)
- [补充 Schema 类型与适配层 API 文档](#change-636f72652d6170692d646f63756d656e746174696f6e) (@schemx/core)

## TypeScript Changes

- [Core 适配层类型边界调整](#change-636f72652d616461707465722d747970652d626f756e64617279) (@schemx/core)
- [按字段名和 Renderer 精确推导 Schema 类型](#change-636f72652d736368656d612d6669656c642d696e666572656e6365) (@schemx/core)
- [提供适配层 Props、配置和动态依赖扩展点](#change-636f72652d616461707465722d657874656e73696f6e2d706f696e7473) (@schemx/core)
- [补充 Schema 类型与适配层 API 文档](#change-636f72652d6170692d646f63756d656e746174696f6e) (@schemx/core)

## Affected Packages

- @schemx/core
