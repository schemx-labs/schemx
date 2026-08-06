# Release Notes

## 版本信息

- 基准版本：无 `@schemx/validator` Tag（仓库暂无该包的独立版本标签）
- 基准提交：`3bd05cd`（首个包提交 `7cc4eab` 的父提交）
- 比较范围：`3bd05cd..HEAD`（包含首个包提交 `7cc4eab`）
- 目标提交：`b2c8dc7`
- 当前分支：`dev`
- 生成日期：`2026-08-05`

## 概览

`@schemx/validator` 是本范围新增的独立校验适配包，用于将可选的 `async-validator` 接入 `@schemx/core` 的 `ValidationAdapter` 协议。包根入口只暴露类型，运行时适配器和预设通过独立子路径加载，以避免未使用适配器时强制加载第三方依赖。

## Features

- 新增 `@schemx/validator/async-validator` 子路径，提供 `AsyncValidatorValidationAdapter` 和 `createAsyncValidatorAdapter()`；适配器接收 `async-validator` 的 `RuleItem` 描述，并把校验错误映射为 Core 的 `ValidationRuleIssue`。（证据：`7cc4eab`、`f799b37`）
- 新增 `@schemx/validator/preset` 子路径，提供 `ValidationAdapterPreset` 和 `createValidationAdapterPreset()`，可一次性生成包含 async-validator 适配器的 `validatorAdapters` 配置。（证据：`7cc4eab`、`f799b37`）
- 适配器将当前字段值和完整表单 `context.values` 传给第三方校验器，关闭其 warning 输出，并将未知异常继续抛出；过期或取消的校验不会回写为旧错误。（证据：`7cc4eab`、`f799b37`）

#### 使用方式

```ts
import { createForm } from "@schemx/core"
import { createValidationAdapterPreset } from "@schemx/validator/preset"

const { validatorAdapters } = createValidationAdapterPreset()
const form = createForm({ validatorAdapters })
```

## Improvements

- Vite 构建同时生成 ESM、CommonJS 和声明文件，并把 `@schemx/core` 与 `async-validator` 外置；新增导出测试覆盖根入口和两个适配器子路径。（证据：`7cc4eab`、`f799b37`）
- 根入口使用 type-only 导出，避免仅导入类型时触发可选的 `async-validator` 运行时加载。（证据：`f799b37`）
- 包的 `build` 流程在打包前执行类型检查，README 补充了适配器安装和子路径用法。（证据：`a2773e2`、`31c0b0d`）

## Dependencies and Compatibility

- `@schemx/core` 是 peer dependency，适配器实现依赖 Core 的 `ValidationAdapter`、`ValidationRuleIssue` 和校验结果契约；应与当前 Core API 一起升级。（证据：`7cc4eab`、`f799b37`）
- `async-validator` 为可选 peer dependency，版本范围为 `^4.0.0`。只有使用 `@schemx/validator/async-validator` 或 `/preset` 时才需要在宿主项目安装它。（证据：范围内 `packages/validator/package.json` Diff）
- 包导出包含 `.`, `./async-validator` 和 `./preset` 三个入口；未提供其他公开子路径。构建产物使用 `dist` 目录，未将本地生成的时间戳配置文件视为发布内容。（证据：`7cc4eab`、`f799b37`）

## Documentation

- 新增并更新 Validator README，说明 async-validator 适配器、预设、可选依赖和子路径导入方式。（证据：`a2773e2`、`9f470d7`）

## Affected Packages

- `@schemx/validator`：新增适配器实现、预设和发布入口。
- `@schemx/core`：提供被适配器消费的校验适配器协议和错误结果类型。
