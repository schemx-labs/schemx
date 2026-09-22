# Release Notes — 1.0.1

## 版本信息

- 目标版本：1.0.1
- 发布包：@schemx/core
- 生成日期：2026-09-23
- 基准版本：@schemx/core@1.0.1
- 比较范围：13c230bee8254718e8137166cf349b0570ad0759..333ac2b9f85bf4d62800cfb04f6b00e8fc3e2fad
- 目标提交：333ac2b
- 当前分支：dev

扩展了 Renderer 与校验结果 API，并调整异步校验的过期结果处理。Registry 创建方式和配置合并行为有兼容变化，见 Breaking Changes。

## Breaking Changes

<a id="change-72656769737472792d72756e74696d652d636f6e7374727563746f7273"></a>

### Registry 改为通过工厂函数创建 (@schemx/core)

`RendererRegistry` 与 `PresetRuleRegistry` 仍作为类型导出，但不再提供运行时类构造器；依赖 `new RendererRegistry()` 或 `new PresetRuleRegistry()` 的代码需要调整。

影响范围：直接实例化这两个 Registry 类的调用方。

#### 迁移说明

影响范围：通过 Registry 类构造函数创建注册表的代码。

1. 将 `new RendererRegistry(fallbackType)` 替换为 `createRendererRegistry(fallbackType)`。
2. 将 `new PresetRuleRegistry()` 替换为 `createPresetRuleRegistry()`。

<a id="change-636f6e6669672d6d657267652d73656d616e74696373"></a>

### 配置合并语义发生变化 (@schemx/core)

`mergeSchemxConfig` 保留为兼容别名，但 `schemaConfig` 现在只合并顶层键，嵌套对象由高优先级值整体替换；跨配置层的 `validatorAdapters` 改为按 ID 合并并优先采用高优先级项。

影响范围：依赖嵌套 `schemaConfig` 深合并，或依赖多个配置层中重复 Adapter ID 与原顺序的调用方。

#### 迁移说明

影响范围：通过 `mergeSchemxConfig`、`mergeConfig` 或多层配置组合嵌套对象及 Adapter 的代码。

1. 在调用合并函数前，显式组装希望保留的嵌套 `schemaConfig` 值。
2. 检查跨层重复的 `validatorAdapters` ID，明确优先级并保留预期生效的实现。

## Features

### @schemx/core

- <a id="change-72656e64657265722d70726f70732d7472616e73666f726d"></a>可注册 `{ component, transformProps }` 描述对象；转换器会收到当前字段的 ViewSchema 与 Form，并返回最终 Renderer Props。直接注册组件的方式仍然可用。（影响范围：开发自定义 Renderer 或 UI 适配层的调用方。）

- <a id="change-76616c69646174696f6e2d726573756c742d6275696c64657273"></a>根入口新增 `createValidationSuccess`、`createValidationFailure` 与 `createValidationCancelled`；失败结果创建时会拒绝空错误数组，取消结果保留 `cancelled: true` 和空错误列表。（影响范围：需要在自定义校验或集成代码中构造 Core 校验结果的调用方。）

## Fixes

### @schemx/core

- <a id="change-63616e63656c2d7374616c652d76616c69646174696f6e2d6f6e2d7265736574"></a>等待依赖或执行异步校验期间发生表单重置时，旧运行会返回取消结果；若校验成功前表单值已变化，也不会再用旧值调用提交成功回调。（影响范围：在异步依赖解析或校验期间重置、更新表单的调用方。）

## API Changes

- [Registry 改为通过工厂函数创建](#change-72656769737472792d72756e74696d652d636f6e7374727563746f7273) (@schemx/core)
- [配置合并语义发生变化](#change-636f6e6669672d6d657267652d73656d616e74696373) (@schemx/core)
- [Renderer 注册支持上下文 Props 转换](#change-72656e64657265722d70726f70732d7472616e73666f726d) (@schemx/core)
- [新增校验结果创建函数](#change-76616c69646174696f6e2d726573756c742d6275696c64657273) (@schemx/core)

## TypeScript Changes

- [Registry 改为通过工厂函数创建](#change-72656769737472792d72756e74696d652d636f6e7374727563746f7273) (@schemx/core)
- [Renderer 注册支持上下文 Props 转换](#change-72656e64657265722d70726f70732d7472616e73666f726d) (@schemx/core)
- [新增校验结果创建函数](#change-76616c69646174696f6e2d726573756c742d6275696c64657273) (@schemx/core)

## Affected Packages

- @schemx/core
