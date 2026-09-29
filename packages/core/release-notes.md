# Release Notes — 1.1.1

## 版本信息

- 目标版本：1.1.1
- 发布包：@schemx/core
- 生成日期：2026-09-29
- 基准版本：@schemx/core@1.1.0
- 比较范围：8c83a9e5e9f1b4bfa36e8e699eec3720b69fa45a..61c5b35351d301d48bf8496044a576619f270446
- 目标提交：61c5b35
- 当前分支：main

Core 新增可复用的字段 key 工具，并调整表单实例扩展与动态回调 API 的类型边界。

## Breaking Changes

<a id="change-696e7374616e63652d747970652d657874656e73696f6e"></a>

### 实例类型扩展改用专用声明入口 (@schemx/core)

SchemxInstance 和 SchemxFormApi 从可声明合并的接口改为类型别名。框架层应通过 SchemxInstanceDefinition 扩展实例类型；动态回调的 SchemxFormApi 仅包含实际提供的 Core 方法。

影响范围：直接对 SchemxInstance 或 SchemxFormApi 做模块声明合并的 TypeScript 适配层需要调整；动态回调中的 form 不再暴露 Vue 专属的 scrollToField 类型。

#### 迁移说明

影响范围：通过模块声明合并扩展 @schemx/core 的 SchemxInstance 或 SchemxFormApi 类型

1. 把框架实例方法的声明合并迁移到 SchemxInstanceDefinition<TValues>。
2. 在 Core Schema 回调中只调用 SchemxFormApi 声明且运行时实际提供的方法。
3. 在 Vue 层通过 Vue 表单实例或组件 ref 调用 scrollToField。
4. 若自定义回调需要额外方法，请同步定义回调类型并注入真实运行时实现。

## Features

### @schemx/core

- <a id="change-6372656174652d6669656c642d6b65792d6578706f7274"></a>Core 根入口新增 createFieldKey，可按 Core 的字段路径规则生成稳定 key，供 Renderer 与适配层复用。（影响范围：开发自定义 Renderer 或适配层时，可复用 Core 字段 key 规则，避免自行拼接路径身份。）

- <a id="change-63616c6c6261636b2d666f726d2d6170692d6d6574686f6473"></a>传给动态 Schema 回调的 SchemxFormApi 现在包含 isLoading 和 clearErrors。（影响范围：动态回调可读取提交状态并清除全部表单错误。）

## API Changes

- [导出 createFieldKey 字段 key 工具](#change-6372656174652d6669656c642d6b65792d6578706f7274) (@schemx/core)
- [扩展动态回调的表单操作方法](#change-63616c6c6261636b2d666f726d2d6170692d6d6574686f6473) (@schemx/core)

## TypeScript Changes

- [实例类型扩展改用专用声明入口](#change-696e7374616e63652d747970652d657874656e73696f6e) (@schemx/core)
- [导出 createFieldKey 字段 key 工具](#change-6372656174652d6669656c642d6b65792d6578706f7274) (@schemx/core)
- [扩展动态回调的表单操作方法](#change-63616c6c6261636b2d666f726d2d6170692d6d6574686f6473) (@schemx/core)

## Affected Packages

- @schemx/core
