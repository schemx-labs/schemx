# Release Notes

## Unreleased

### 新增功能

- `UploadRenderer` 新增 `listType: "card" | "list"`，可在图片卡片网格与横向附件列表之间切换。
- `UploadRenderer` 新增图片全屏预览、`previewOptions`、`imageFit` 与 `beforeDelete` 删除拦截支持；导出 `UploadListType`。

### 优化与调整

- 上传文件展示会统一解析文件名、扩展名、图片类型与上传状态；只读、禁用、删除和 pending 状态在两种列表模式下保持一致。
- `SensitiveInputRenderer` 的展开状态改由内部管理，使用 `defaultRevealed` 设置初始值，并继续通过 `reveal-change` 通知变化。

## 版本信息

- 基准版本：`@schemx/vant@0.2.3`
- 基准提交：`c9b1d20`
- 比较范围：`@schemx/vant@0.2.3..HEAD`
- 目标提交：`b2c8dc7`
- 当前分支：`dev`
- 生成日期：`2026-08-06`

## 概览

本轮主要同步 Core/Vue 的公共契约，收紧 Vant 渲染器工具的 TypeScript 类型，并将包构建纳入类型检查。范围内没有可证实的新 Vant 运行时组件，包版本、导出路径、peerDependencies 和运行时依赖未改变；但 Vant 会通过导出链继承 Core/Vue 的校验、Schema 和配置 API 变化。

## Breaking Changes

### @schemx/vant：公共导出链与工具类型约束

- Vant 根入口随 `@schemx/vue` / `@schemx/core` 同步到新的注册表名称：`validationRuleRegistry`、`createValidationRuleRegistry`、`ValidationRuleRegistry` 和 `RendererRegistry` 保留，旧的 `validatorRegistry`、`createValidatorsRegistry` 不再作为当前公共入口。
- `getFieldProps` 的公开泛型约束从 `Record<string, any>` 收紧为 `Record<string, unknown>`；`FindTreeItemResult` 和 `findTreeItem` 现在使用 `TNode`、`TValue` 泛型，默认节点类型为 `Record<string, unknown>`、值类型为 `unknown`。直接依赖旧的 `any` 赋值或显式类型约束的调用方可能需要补充类型声明；运行时查找接口的参数形状未改变。

### SensitiveInput 不再支持受控 revealed 状态

SensitiveInput 运行时不再读取 revealed 或调用 onRevealChange，update:revealed 事件也被移除；展开状态改由内部状态管理，初始值仅取 defaultRevealed，变化通过 reveal-change 通知。

影响范围：依赖 v-model:revealed、revealed prop 实时控制，或依赖 onRevealChange 回调的 SensitiveInput 调用方。

#### 迁移说明

```ts
import { findTreeItem, getFieldProps } from "@schemx/vant"

type TreeOption = {
  text: string
  value: string
  children?: TreeOption[]
}

declare const tree: TreeOption[]

const attrs: Record<string, unknown> = { rightIcon: "arrow" }
const rightIcon = getFieldProps(attrs, "rightIcon", "arrow")
const result = findTreeItem<TreeOption, string>(tree, "guangzhou", {
  labelKey: "text",
})
```

## Fixes

- `findTreeItem` 现在将节点标签路径显式转换为字符串，返回的 `labels: string[]` 与实际运行时值保持一致；节点值路径继续按 `TValue` 保留类型。

- 可编辑且 value 为空时组件直接渲染输入框并隐藏展开按钮；首次输入后保持展开，避免从空值切换到非空值时立即回到脱敏展示态。（影响范围：需要在表单初始值为空且字段可编辑时直接录入敏感字段的用户。）

## Improvements

- `findTreeItem` 的节点、目标值和返回结果支持泛型推导；`getReadonlyDisplayValue`、渲染器类型扩展和 Vant 对 Core `SchemxRendererDefinition<TValues>` 的声明使用了更明确的泛型命名。
- Picker 的 `columns` 明确为 `computed<PickerOption[]>`，多个 renderer Props 的 `@vue-ignore` 标注位置同步调整，减少 Vue SFC 类型解析误报。
- Vant 包的 `build` 流程在 Vite 构建前执行 `type-check`，把公共类型错误提前纳入发布检查。

## Dependencies and Compatibility

- `@schemx/vant` 的 `package.json#exports`、版本、`@schemx/core` / `@schemx/vue` / `vant` / `vue` peerDependencies 和运行时依赖在本范围内未改变。
- Vant 根导出的表单组件、Registry 和公共类型会随 `@schemx/core`、`@schemx/vue` 的校验、Schema、配置和字段错误重构变化；升级时应将三个 `@schemx` 包作为同一兼容性批次检查。
- 范围内 renderer 文件的多数变化是类型标注、泛型命名和格式整理，没有证据表明新增了 Vant 运行时组件能力。

## Documentation

- 更新 Vant README、Input 类型示例、Picker 类型说明以及 Core/Vue 新导出名称和配置用法。

## Affected Packages

- `@schemx/vant`：渲染器工具类型、类型检查构建和公共导出链直接变化。
- `@schemx/vue`：Vant 组件继续使用 Vue 表单和配置 API，并继承新的导出类型。
- `@schemx/core`：Vant 根导出继承新的 Registry、Schema、配置和校验契约。
