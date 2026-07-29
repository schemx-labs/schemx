# Release Notes

## 版本信息

- 基准版本：`@schemx/vant@0.2.3`
- 比较范围：`@schemx/vant@0.2.3..HEAD`
- 基准提交：`c9b1d20`
- 目标提交：`0a732d7`
- 当前分支：`dev`
- 生成日期：2026-07-29

## 概览

本版本主要让 Vant renderer 与新的 Core/Vue Schema、校验和泛型契约保持一致。未发现 `@schemx/vant` 的 `package.json#exports`、Vant peer dependency 范围或样式入口发生不兼容修改；升级影响主要来自其依赖的 Core/Vue Breaking Changes。

## Features

- Vant renderer 已适配新的 Group/Dependency 容器状态，可随 `visible`、`readonly`、`disabled`、`dependencies` 与 Group 折叠策略获得来自 Core/Vue 的一致行为。
- `SchemxRendererDefinition` 的 Vant renderer 映射使用 `TValues` 泛型，并将 dictionary 型 Radio、Checkbox、Picker、SelectPicker、Selector Props 与表单值类型关联。
- `findTreeItem` 现在支持 `TNode` 与 `TValue` 泛型，返回 `FindTreeItemResult<TNode, TValue>`；`node`、`values` 不再退化为 `Record<string, any>` 与 `any[]`。

## Improvements

- `getFieldProps` 改用 `Record<string, unknown>` 和精确键值泛型，`getReadonlyDisplayValue`、树形查找结果与 renderer 工具的类型传播更安全。
- 各 renderer 已同步 Vue 字段错误数组、Schema 配置与命名规范；本范围内的多数 renderer 源码改动为类型、文档或结构性适配，未发现新的公开 Vant 组件或样式入口。
- `build` 脚本在 Vite 打包前执行 `pnpm run type-check`，使发布前构建能够阻止 TypeScript 类型错误。

## Dependencies and Compatibility

- `@schemx/vant` 的 peer dependency 范围仍为 `@schemx/core: workspace:*`、`@schemx/vue: workspace:*`、`vant: ^4.0.0`、`vue: ^3.0.0`；包根与 `./style.css` exports 未变。
- 升级时需同步迁移 `@schemx/core` / `@schemx/vue` 的校验 Registry 名称、字段错误 API、`schemaConfig` 与 Group/Dependency Schema 写法；这些变化经依赖链会反映到 Vant 表单使用方式。

## Documentation

- 更新 Vant README，补充 renderer、Dictionary、表单配置与跨包 API 的说明。

## Affected Packages

- `@schemx/vant`（直接修改）
- `@schemx/vue`（直接依赖）
- `@schemx/core`（间接依赖）
