# Release Notes — 1.0.0

## 版本信息

- 目标版本：1.0.0
- 发布包：@schemx/vant
- 生成日期：2026-09-11
- 基准版本：@schemx/vant@1.0.0
- 比较范围：9696a15daf708ed8f1438f4cf3324e50019f95b1..53ca367fb7757dcc47f2abe27ed31a798a08c064
- 目标提交：53ca367
- 当前分支：main

本次版本同步 Vant Renderer 与 @schemx/vue 的公共 Props 基类，保持自定义 Renderer 的 Vue 事件和状态契约一致，并更新类型与示例文档。

## Important Notices

- 目标提交尚未创建匹配的 @schemx/*@1.0.0 Tag；本说明的版本号取自目标清单，仅记录 HEAD 相对现有 1.0.0 基线的候选变更。
- 本批次同步涉及 @schemx/core、@schemx/vue 与 @schemx/vant 的公共类型契约，建议作为同一兼容性批次升级。

## Improvements

### @schemx/vant

- <a id="change-76616e742d7675652d70726f70732d616c69676e6d656e74"></a>Vant 的输入、选择、日期、上传等 Renderer 类型改用 @schemx/vue 的 SchemxVueBaseComponentProps，统一 Vue 的 value、事件、状态和公共 Renderer Props 类型边界。（影响范围：直接引用 Vant Renderer Props，或同时维护 Core/Vue/Vant 自定义 Renderer 类型的 TypeScript 项目。）

## Documentation

### @schemx/vant

- <a id="change-76616e742d637573746f6d2d72656e64657265722d646f6373"></a>Vant README 更新 Context、Vue Props 和 Core 类型清单；Vant 示例新增组合多个 Vant 子控件的 contact-card Renderer，并演示 useFieldContext()。（影响范围：需要注册自定义 componentType、组合 Vant 子控件或读取字段状态的开发者。）

## API Changes

- [Vant Renderer 对齐 Vue 公共 Props 契约](#change-76616e742d7675652d70726f70732d616c69676e6d656e74)
- [补充 Vant 自定义 Renderer 与公共 API 文档](#change-76616e742d637573746f6d2d72656e64657265722d646f6373)

## TypeScript Changes

- [Vant Renderer 对齐 Vue 公共 Props 契约](#change-76616e742d7675652d70726f70732d616c69676e6d656e74)
- [补充 Vant 自定义 Renderer 与公共 API 文档](#change-76616e742d637573746f6d2d72656e64657265722d646f6373)

## Affected Packages

- @schemx/vant
