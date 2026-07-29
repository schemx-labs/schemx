# Release Notes

## 版本信息

- 基准版本：`@schemx/vant@0.2.3`（`@schemx/validator` 在本范围内首次加入工作区）
- 比较范围：`@schemx/vant@0.2.3..HEAD`
- 基准提交：`c9b1d20`
- 目标提交：`0a732d7`
- 当前分支：`dev`
- 生成日期：2026-07-29

## 概览

`@schemx/validator` 是新包，用于承载可选的第三方校验适配器，避免 Core 在默认安装中绑定未使用的校验库。本次发布提供 `async-validator` adapter 与预设入口。

## Features

- 新增子路径入口 `@schemx/validator/async-validator`，导出 `createAsyncValidatorAdapter()` 与 `AsyncValidatorValidationAdapter`。adapter 接受单条 `async-validator` descriptor 或 descriptor 数组，可直接放入字段 `rules`。
- adapter 在运行时把当前字段值与完整表单快照交给 `async-validator`，将库返回的错误映射为 Core `ValidationRuleIssue`；校验被中止时返回成功规则结果以避免陈旧错误落入当前表单状态。
- 新增 `@schemx/validator/preset`，导出 `createValidationAdapterPreset()`。返回值的 `validatorAdapters` 可直接传给 `createForm()` 或 `configureSchemx()`。
- 根入口只导出适配器与预设的类型，运行时实现保留在子路径入口，避免未使用的 optional peer dependency 被意外加载。

## Dependencies and Compatibility

- `@schemx/core` 是 peer dependency，使用的是本次新增的 `ValidationAdapter` / `validatorAdapters` 协议。
- `async-validator` 的 peer dependency 范围为 `^4.0.0`，并标记为 optional；只有导入 `@schemx/validator/async-validator` 或 `@schemx/validator/preset` 时才需要安装它。
- 包提供 ESM、CommonJS 与类型声明，公开子路径仅包括 `.`, `./async-validator` 和 `./preset`。

## Documentation

- 新增包 README，说明 adapter 注册方式、optional peer dependency 与子路径导入边界。

## Affected Packages

- `@schemx/validator`（新包）
- `@schemx/core`（adapter 协议提供方）
