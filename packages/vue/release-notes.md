# Release Notes — 1.0.1

## 版本信息

- 目标版本：1.0.1
- 发布包：@schemx/vue
- 生成日期：2026-09-11
- 基准版本：@schemx/vue@1.0.0
- 比较范围：9696a15daf708ed8f1438f4cf3324e50019f95b1..a62db33c25a2d43a9a071eec8748f75ad09d477a
- 目标提交：a62db33
- 当前分支：main

1.0.1 新增统一 Form/Field Context 和共享 Vue Runtime，补齐 Renderer、插槽和布局的 TypeScript 契约，并保留旧 Context Provider API 作为兼容入口。

## Important Notices

- 目标提交尚未创建匹配的 @schemx/vue@1.0.1 Tag；目标版本取自目标提交中的 package.json。
- Core、Vue 与 Vant 的公共类型存在交叉依赖，建议同步升级至 1.0.1。

## Features

### @schemx/vue

- <a id="change-7675652d756e69666965642d636f6e74657874"></a>新增 provideFormContext({ form, schemaConfig })、useFormContextValue()、useFormRuntimeContext()、createFieldContext() 和 useFieldContext()；表单子树可从一个 Provider 获取实例与展示配置，自定义 Renderer 也可读取当前字段 Context。（影响范围：自定义 Field、Renderer 或 Hook 需要同时访问表单实例、展示配置或当前字段状态时，可以使用统一 Context；createFormContext() 与 createFormConfigContext() 仍保留兼容。）

## Fixes

### @schemx/vue

- <a id="change-7675652d6669656c642d63616c6c6261636b732d616e642d6c6162656c"></a>Field 现在会调用 Schema 顶层的 onChange(value, form) 与 onBlur(form)，向 Renderer 注入解析后的 readonly、disabled、placeholder 和只读占位文本，并在默认标签中渲染 labelIcon。（影响范围：依赖字段级 onChange/onBlur 回调、只读或禁用状态透传，或在 Schema 中设置 labelIcon 的 Vue 表单可直接获得预期行为。）

## Improvements

### @schemx/vue

- <a id="change-7675652d7368617265642d72756e74696d65"></a>Vue bridge 通过共享 VueFormRuntime 和状态适配器复用响应式资源；useField、useFormSelector、useViewSchemas 与 useWatch 的订阅会随 Vue scope owner 自动释放，旧 Runtime 消费者仍可读取兼容的 core 字段。（影响范围：同一表单同时使用多个 Vue 状态 Hook，或在组件卸载与重建期间反复创建桥接状态的项目，可减少重复资源和残留订阅。）

- <a id="change-7675652d616461707465722d747970652d636f6e747261637473"></a>新增 SchemxVueBaseComponentProps、SchemxVueLayout、SchemxFieldSlots、SchemxFieldSlotValue 和 SchemxGroupSlots，并通过声明合并把 Vue 展示属性和 Renderer Props 接入 Core。（影响范围：自定义 Vue Renderer、Field/Group 插槽和栅格布局可以复用字段名、值、错误和布局的 TypeScript 契约。）

## Documentation

### @schemx/vue

- <a id="change-7675652d6170692d646f63756d656e746174696f6e"></a>Vue README 补充统一 Context、共享 Runtime、Vue Renderer Props、插槽、布局和 Core 配置边界的用法与公开导出清单。（影响范围：升级 Vue 适配包或编写自定义 Renderer 的开发者可以按新的 Context 和类型入口迁移。）

## API Changes

- [新增统一 Form 与 Field Context](#change-7675652d756e69666965642d636f6e74657874) (@schemx/vue)
- [补充 Renderer、布局和插槽类型契约](#change-7675652d616461707465722d747970652d636f6e747261637473) (@schemx/vue)
- [接通字段级回调并渲染标签图标](#change-7675652d6669656c642d63616c6c6261636b732d616e642d6c6162656c) (@schemx/vue)
- [更新 Vue Context 与适配层 API 文档](#change-7675652d6170692d646f63756d656e746174696f6e) (@schemx/vue)

## TypeScript Changes

- [补充 Renderer、布局和插槽类型契约](#change-7675652d616461707465722d747970652d636f6e747261637473) (@schemx/vue)
- [更新 Vue Context 与适配层 API 文档](#change-7675652d6170692d646f63756d656e746174696f6e) (@schemx/vue)

## Affected Packages

- @schemx/vue
