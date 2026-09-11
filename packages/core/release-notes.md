# Release Notes — 1.0.0

## 版本信息

- 目标版本：1.0.0
- 发布包：@schemx/core
- 生成日期：2026-09-11
- 基准版本：@schemx/core@1.0.0
- 比较范围：9696a15daf708ed8f1438f4cf3324e50019f95b1..53ca367fb7757dcc47f2abe27ed31a798a08c064
- 目标提交：53ca367
- 当前分支：main

本次版本重构了 Core 的 Schema 公共类型与适配层边界：字段值、Renderer Props 和依赖扩展获得更精确的类型推导，同时将 UI 展示默认值交给适配层。使用 Vue/Vant 适配包的项目应同步检查三包公共契约。

## Important Notices

- 目标提交尚未创建匹配的 @schemx/*@1.0.0 Tag；本说明的版本号取自目标清单，仅记录 HEAD 相对现有 1.0.0 基线的候选变更。
- 本批次同步涉及 @schemx/core、@schemx/vue 与 @schemx/vant 的公共类型契约，建议作为同一兼容性批次升级。

## Breaking Changes

<a id="change-636f72652d75692d616461707465722d626f756e64617279"></a>

### Core 的 Renderer Props 与 UI 默认配置改由适配层提供

Core 的 SchemxBaseComponentProps 仅保留框架无关的 Renderer 属性；Vue 专属的 align、value、onUpdate:value、onChange 和 onBlur 由适配层类型承担。defaultSchemxConfig 不再提供标签、内容对齐、冒号和必填标记等 UI 默认值，并新增声明合并扩展点。

影响范围：直接导入 Core SchemxBaseComponentProps 或 SchemxRuntimeInjectedProp 定义 UI Renderer，或读取 Core UI 默认配置的适配层。

#### 迁移说明

影响范围：Core UI 类型、Renderer 默认 Props 和框架适配层配置

1. Vue Renderer 将 SchemxBaseComponentProps 改为从 @schemx/vue 导入 SchemxVueBaseComponentProps。
2. 移除对 Core 根入口 SchemxRuntimeInjectedProp 的依赖；value 和事件回调由 UI 适配层的 Renderer Props 契约管理。
3. 其他 UI 适配层通过 SchemxComponentPropsDefinition 与 SchemxSchemaConfigDefinition 声明自身 Props 和展示默认值。

替代方案：@schemx/vue 的 SchemxVueBaseComponentProps，或适配层自己的声明合并类型

## Features

### @schemx/core

- <a id="change-636f72652d736368656d612d76616c75652d696e666572656e6365"></a>SchemxField 现在同时按字段 name 和 componentType 分发，规则、required.isEmpty、initialValue 与 onChange 能获得当前字段值类型；createForm({ schemas })、带 initialValues 的 createForm 和 createSchemas(schemas) 也可从 Schema 输入推导表单值类型。（影响范围：使用对象值、自定义 Renderer 或内联 Schema 的 TypeScript 项目可减少字段值联合误报，并在初始值、规则和回调中更早发现类型错误。）

- <a id="change-636f72652d646570656e64656e63792d657874656e73696f6e2d6b657973"></a>字段 dependencies 除 Core 内置属性外，还会解析依赖对象中由适配层声明的额外属性，并将其写入运行时覆盖；适配层不需要让 Core 预先知道每个展示属性的名称。（影响范围：需要根据其他字段动态切换自定义展示属性的 UI 适配层或 Renderer。）

## Documentation

### @schemx/core

- <a id="change-636f72652d736368656d612d747970652d646f6373"></a>Core README 补充了适配层扩展类型、Schema 值类型推导和 Core/Vue 配置边界；仓库新增 Schema 类型推导说明文档。（影响范围：需要迁移自定义 Renderer、Schema 类型或框架适配层配置的开发者。）

## API Changes

- [Core 的 Renderer Props 与 UI 默认配置改由适配层提供](#change-636f72652d75692d616461707465722d626f756e64617279)
- [Schema 字段值与 Renderer 类型推导更精确](#change-636f72652d736368656d612d76616c75652d696e666572656e6365)
- [dependencies 支持适配层扩展的动态属性](#change-636f72652d646570656e64656e63792d657874656e73696f6e2d6b657973)

## TypeScript Changes

- [Core 的 Renderer Props 与 UI 默认配置改由适配层提供](#change-636f72652d75692d616461707465722d626f756e64617279)
- [Schema 字段值与 Renderer 类型推导更精确](#change-636f72652d736368656d612d76616c75652d696e666572656e6365)
- [dependencies 支持适配层扩展的动态属性](#change-636f72652d646570656e64656e63792d657874656e73696f6e2d6b657973)
- [补充 Schema 类型推导与适配层 API 文档](#change-636f72652d736368656d612d747970652d646f6373)

## Affected Packages

- @schemx/core
