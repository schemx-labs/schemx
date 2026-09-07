# Release Notes — 1.0.0-next.4

## 版本信息

- 目标版本：1.0.0-next.4
- 发布包：@schemx/vant
- 生成日期：2026-09-04
- 基准版本：@schemx/vant@0.2.3
- 比较范围：c9b1d200d09002498b902dd96f8ec84d61cd21fe..0136a0a47d8daee37019ac3e30bfd701c6b27936
- 目标提交：0136a0a
- 当前分支：dev

本预发布版本同步了 Core/Vue 的表单与类型契约，并增强了 UploadRenderer 与 SensitiveInput。SensitiveInput 的显示状态控制和若干工具类型存在不兼容变化，升级前请检查迁移说明。

## Important Notices

- `1.0.0-next.4` 是预发布版本，公共 API 仍可能继续调整。

## Breaking Changes

<a id="change-76616e742d73656e7369746976652d636f6e74726f6c6c65642d7374617465"></a>

### SensitiveInput 不再支持受控 revealed 状态

SensitiveInput 运行时不再读取 `revealed` 或调用 `onRevealChange`，也不再发出 `update:revealed`；展开状态改由内部状态管理，变化仍通过 `reveal-change` 通知。

影响范围：依赖 `v-model:revealed`、`revealed` 实时控制或 `onRevealChange` 回调的调用方。

#### 迁移说明

影响范围：SensitiveInput 的展开/收起状态管理

1. 移除 `v-model:revealed`、`revealed` 和 `onRevealChange` 的控制逻辑。
2. 使用 `defaultRevealed` 设置初始状态，并通过 `reveal-change` 观察状态变化。
3. 需要控制显示时改为在业务层管理字段值或重新创建渲染器实例。

替代方案：`defaultRevealed` + `reveal-change`

<a id="change-76616e742d7574696c6974792d747970652d736166657479"></a>

### Vant 工具类型约束收紧

`getFieldProps` 的泛型约束从 `Record<string, any>` 收紧为 `Record<string, unknown>`；`FindTreeItemResult` 和 `findTreeItem` 显式使用 `TNode`、`TValue`，返回的 `labels` 固定为 `string[]`。

影响范围：依赖旧 `any` 约束、未声明节点结构或依赖非字符串 labels 返回值的 TypeScript 调用方。

#### 迁移说明

影响范围：Vant 工具函数与树形选择类型

1. 将 attrs 和树节点类型声明为可索引对象，避免依赖隐式 any。
2. 按 `findTreeItem<TNode, TValue>(tree, targetValue, options)` 传入节点和值泛型。
3. 按 `labels: string[]` 处理标签路径；值路径按 `TValue` 处理。

替代方案：`getFieldProps<TProps>` 与 `findTreeItem<TNode, TValue>`

## Features

### @schemx/vant

- <a id="change-76616e742d75706c6f61642d72656e6465726572"></a>新增 `listType: "card" | "list"`、`previewFullImage`、`previewOptions`、`imageFit` 和 `beforeDelete`；上传文件展示统一解析文件名、扩展名、图片类型与状态，并导出 `UploadListType`。

## Fixes

### @schemx/vant

- <a id="change-76616e742d747265652d6c6162656c73"></a>`findTreeItem` 会将节点标签路径显式转换为字符串，避免数字或其他值直接进入 `labels`；节点值路径继续保留 TValue。

- <a id="change-76616e742d73656e7369746976652d696e7075742d656d707479"></a>可编辑且值为空时直接进入输入框并隐藏展开按钮；默认允许只读状态查看完整值，并统一处理空值、文件名和脱敏文本的展示状态。

## Improvements

### @schemx/vant

- <a id="change-76616e742d72656e64657265722d7479706573"></a>各 Vant renderer 对 Core 的 `SchemxBaseComponentProps`、字典类型和 `SchemxRendererDefinition<TValues>` 使用更明确的泛型及 Vue SFC 忽略标注，减少公共类型解析误报。

- <a id="change-76616e742d747970652d636865636b2d6275696c64"></a>Vant 包的 `build` 现在先执行 `type-check`，公共类型错误会在 Vite 构建前失败。

## Documentation

### @schemx/vant

- <a id="change-76616e742d646f63756d656e746174696f6e"></a>Vant README 补充 Upload、SensitiveInput、Renderer 类型、Core/Vue 配置和动态表单示例。

## API Changes

- [SensitiveInput 不再支持受控 revealed 状态](#change-76616e742d73656e7369746976652d636f6e74726f6c6c65642d7374617465)
- [Vant 工具类型约束收紧](#change-76616e742d7574696c6974792d747970652d736166657479)
- [UploadRenderer 支持列表模式与图片预览](#change-76616e742d75706c6f61642d72656e6465726572)
- [更新 Vant Renderer 与动态表单文档](#change-76616e742d646f63756d656e746174696f6e)

## TypeScript Changes

- [Vant 工具类型约束收紧](#change-76616e742d7574696c6974792d747970652d736166657479)
- [修复树形路径标签类型与运行时值](#change-76616e742d747265652d6c6162656c73)
- [同步 Renderer Props 与泛型命名](#change-76616e742d72656e64657265722d7479706573)
- [发布构建纳入类型检查](#change-76616e742d747970652d636865636b2d6275696c64)
- [与 Core/Vue 公共导出链同步](#change-76616e742d636f6d70617469626c652d7675652d636f7265)

## Dependencies and Compatibility

- <a id="change-76616e742d636f6d70617469626c652d7675652d636f7265"></a>Vant 根入口重新导出 Vue/Core API，运行时和 peerDependencies 保持原有包范围；升级时应将三个 `@schemx` 包作为同一兼容性批次检查。

## Affected Packages

- @schemx/vant
