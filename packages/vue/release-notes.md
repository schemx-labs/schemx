# Release Notes — 1.0.0

## 版本信息

- 目标版本：1.0.0
- 发布包：@schemx/vue
- 生成日期：2026-09-11
- 基准版本：@schemx/vue@1.0.0
- 比较范围：9696a15daf708ed8f1438f4cf3324e50019f95b1..53ca367fb7757dcc47f2abe27ed31a798a08c064
- 目标提交：53ca367
- 当前分支：main

本次版本重构了 Vue 的 Renderer Props、Form Context 和共享状态桥接：新增统一 Context 与插槽类型契约，并补齐字段级回调和标签图标行为。自定义 Vue Renderer 应与 Core/Vant 一起检查公共类型。

## Important Notices

- 目标提交尚未创建匹配的 @schemx/*@1.0.0 Tag；本说明的版本号取自目标清单，仅记录 HEAD 相对现有 1.0.0 基线的候选变更。
- 本批次同步涉及 @schemx/core、@schemx/vue 与 @schemx/vant 的公共类型契约，建议作为同一兼容性批次升级。

## Breaking Changes

<a id="change-7675652d72656e64657265722d70726f70732d626f756e64617279"></a>

### Vue Renderer 使用 SchemxVueBaseComponentProps

@schemx/vue 新增 SchemxVueBaseComponentProps，集中承载 align、value、onUpdate:value、onChange 和 onBlur 等 Vue Renderer 契约；Core 的 SchemxBaseComponentProps 不再承担这些 Vue 专属属性。

影响范围：使用 SchemxBaseComponentProps 编写 Vue/Vant 自定义 Renderer，或依赖 Core UI 默认配置的项目。

#### 迁移说明

影响范围：Vue/Vant 自定义 Renderer 与适配层声明合并

1. 从 @schemx/vue 导入 SchemxVueBaseComponentProps，并用它替换 Vue Renderer 对 Core SchemxBaseComponentProps 的依赖。
2. 将 UI 展示默认值放入 Vue 适配层配置；其他扩展字段通过 SchemxFieldDefinition、SchemxComponentPropsDefinition 或 SchemxSchemaConfigDefinition 声明。
3. 升级 @schemx/vant 时同步升级 @schemx/core，避免 Renderer Props 基类来源不一致。

替代方案：SchemxVueBaseComponentProps<TValues>

## Deprecations

### @schemx/vue

<a id="change-7675652d6c65676163792d636f6e746578742d6465707265636174696f6e"></a>

### 旧的分离式 Form Context Provider 进入兼容期

createFormContext() 与 createFormConfigContext() 仍保留兼容，但已不再是推荐的完整 Provider 组合；新代码应使用统一 Form Context。

影响范围：在 setup() 中分别注册 Form Instance 和 schemaConfig 的自定义 Provider。

#### 迁移说明

影响范围：旧的 createFormContext(form) 与 createFormConfigContext({ schemaConfig }) 组合

1. 将两次 Provider 调用合并为 provideFormContext({ form, schemaConfig })。
2. 需要分别读取实例或配置时，使用 useFormContext() 或 useFormConfigContext()；需要完整对象时使用 useFormContextValue()。

替代方案：provideFormContext({ form, schemaConfig })

## Features

### @schemx/vue

- <a id="change-7675652d666f726d2d636f6e74657874"></a>新增 provideFormContext({ form, schemaConfig }) 与 useFormContextValue()，一次向后代提供 Vue Form Instance 和展示配置；嵌套 Form 使用最近上下文，配置对象可保持响应式。（影响范围：自定义 Field、Renderer 或 Hook 子树需要同时读取表单实例和展示配置的项目。）

## Fixes

### @schemx/vue

- <a id="change-7675652d6669656c642d63616c6c6261636b732d6c6162656c2d69636f6e"></a>Vue Field 现在会调用字段 Schema 顶层的 onChange(value, form) 与 onBlur(form)，并在默认标签中渲染 labelIcon；Renderer 仍接收由 Vue 层归一化的状态和事件 Props。（影响范围：依赖字段级 onChange/onBlur 回调，或在 Schema 中设置 labelIcon 的 Vue 表单。）

## Improvements

### @schemx/vue

- <a id="change-7675652d736c6f742d636f6e74726163742d7479706573"></a>新增 SchemxFieldSlots、SchemxFieldSlotValue、SchemxGroupSlots，并为字段插槽的字段名、value、columnElement 和 errors 提供可复用的 TypeScript 类型；运行时插槽仍传入 schema、componentProps、value、field 和 form。（影响范围：为动态字段名、字段 Content/Error 插槽或 Group 插槽编写类型安全模板和渲染函数的 Vue 项目。）

- <a id="change-7675652d7368617265642d72756e74696d652d6c6966656379636c65"></a>同一 Core Form 现在通过共享 VueFormRuntime 和状态适配器复用 Vue 响应式资源；useField、useFormSelector、useViewSchemas 与 useWatch 的订阅会随 Vue scope owner 自动释放。（影响范围：同一表单同时使用多个 Vue 状态 Hook，或在组件卸载/重建期间反复创建桥接状态的项目。）

## Documentation

### @schemx/vue

- <a id="change-7675652d6170692d646f6373"></a>Vue README 更新统一 Form Context、Vue Renderer 公共 Props、Slot Props、配置边界和自定义 Renderer 用法。（影响范围：需要按新 Context、Props 或插槽类型迁移 Vue 表单和自定义 Renderer 的开发者。）

## API Changes

- [Vue Renderer 使用 SchemxVueBaseComponentProps](#change-7675652d72656e64657265722d70726f70732d626f756e64617279)
- [新增统一 Form Context Provider](#change-7675652d666f726d2d636f6e74657874)
- [旧的分离式 Form Context Provider 进入兼容期](#change-7675652d6c65676163792d636f6e746578742d6465707265636174696f6e)
- [Field 与 Group 插槽获得可复用类型契约](#change-7675652d736c6f742d636f6e74726163742d7479706573)
- [Field 补齐 Schema 回调与标签图标渲染](#change-7675652d6669656c642d63616c6c6261636b732d6c6162656c2d69636f6e)
- [补充 Vue Context、Renderer Props 与插槽文档](#change-7675652d6170692d646f6373)

## TypeScript Changes

- [Vue Renderer 使用 SchemxVueBaseComponentProps](#change-7675652d72656e64657265722d70726f70732d626f756e64617279)
- [Field 与 Group 插槽获得可复用类型契约](#change-7675652d736c6f742d636f6e74726163742d7479706573)
- [补充 Vue Context、Renderer Props 与插槽文档](#change-7675652d6170692d646f6373)

## Affected Packages

- @schemx/vue
