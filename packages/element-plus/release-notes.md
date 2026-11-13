# Release Notes - 0.1.0

## 版本信息

- 目标版本：0.1.0。
- 发布包：`@schemx/element-plus`。
- 说明更新日期：2026-11-13。
- 发布状态：后续发布，本次不发布。

接入上游 Core 2.0 的兼容 API 移除，不再透传全局配置 getter；本包默认配置方法和 Registry 保持独立。

- 比较基线：无已发布正式版本，按首次正式发布整理；已有 beta 标签不作为正式版基线。
- 目标提交：`089dab17e88a8705efe0935a29c4c9e139119ab0`。

## Important Notices

- 0.1.0 将适配 Core 2.0，涉及公共 API 与 TypeScript 类型变化，升级方式见 [Core 2.0 迁移指南](../core/MIGRATION.md)。
- 本包继续独立于 Core、Vue、Vant 的 2.0.0 发布批次；以下变更计划随后续 0.1.0 发布。

## Breaking Changes

### Core 透传接口与配置契约调整

根入口透传的 Core API 同步收敛：不再导出 `createField`、`createSignalEffect`、`runSignalUntracked`、`createSignalWatch`、`createDebouncedSignalWatch`、`mergeSchemxConfig`、`mergeAndResolveSchemxConfig` 等旧入口。使用这些高级接口的扩展需改用当前公开状态适配入口或重新评估实现；不要继续依赖旧 Runtime 内部结构。普通字段操作和监听优先使用表单实例及 Vue 的 `useField`、`useWatch` 系列 Hook。

共享配置的字段默认值放入 `schemaConfig`；Form 上仍使用平铺的标签、状态及布局 Props。自定义适配扩展需核对新的 `SchemxConfigDefinition`、`SchemxSchemaConfigDefinition` 和 Renderer 类型契约，具体迁移见 [Core 迁移指南](../core/MIGRATION.md)。

### 样式变量改用语义命名

旧 CSS 变量已移除，不提供兼容别名。自定义主题需迁移：`--schemx-primary-color` → `--schemx-color-primary`，`--schemx-text-color` → `--schemx-color-text-primary`，`--schemx-padding-*` → `--schemx-space-*`，`--schemx-border-radius-*` → `--schemx-radius-*`，`--schemx-font-size-md` → `--schemx-font-size-base`，`--schemx-component-size` → `--schemx-control-height`。

定位提示的背景和描边分别使用 `--schemx-field-highlight-bg`、`--schemx-field-highlight-border-color`；warning/error 使用对应的 `--schemx-color-warning-*` / `--schemx-color-error-*`。标签、错误和分组标题可通过独立的颜色、字号及行高变量调整。完整契约见 [样式变量文档](../../docs/design-tokens.md)。

### 根入口不再透传 getGlobalSchemxConfig

`@schemx/element-plus` 不再透传上游 Core 的模块级 `getGlobalSchemxConfig()`。

```ts
// 旧写法：读取 Core 模块级全局配置。
import { getGlobalSchemxConfig } from "@schemx/element-plus"

const config = getGlobalSchemxConfig()
```

```ts
// 读取当前 UI 包的默认配置。
import { getConfig } from "@schemx/element-plus"

const config = getConfig()
```

`getConfig()` 返回本包默认配置，不是某个 App / Form 的当前配置。若需要独立共享配置，请使用 `createSchemx(config)` 工厂，再调用该工厂的 `getConfig()`；不要依赖已移除的 Core 全局状态。

### 透传的 Core Renderer Props 泛型调整

`SchemxBaseComponentProps<TValues, TName, TValue>` 改为 `SchemxBaseComponentProps<TValues>`。特定字段值类型请在 Renderer 自有 Props 中声明；Vue 声明合并继续提供值与事件类型。

## Features

- 首次正式发布 Element Plus 表单适配，提供内置 Renderer、原生布局与按钮适配，以及上传预览和敏感输入交互。
- 支持 `col: "auto"` 自动列布局，并支持通过 `actionCol` 单独配置操作区布局。
- `scrollToField()` 默认高亮目标字段；可通过 `highlight: false` 关闭，或配置 `duration` 和 `default`、`warning`、`error` 类型。`duration: 0` 持续显示，直至用户操作目标区域、发起新定位或目标失效；高亮不改变校验状态。
- 支持 `buttonComponent` 替换按钮实现，提交和重置按钮通过 `buttonProps` 配置外观，原生提交行为由表单操作区管理。
- 新增 `SchemxSearch` / `schemxSearch` 搜索表单，支持字段折叠及展开，保留提交、重置和公开实例能力。
- Form、`createForm()` 与 `useForm()` 绑定本包工厂及 Registry，支持通过本包 `configureSchemx()` 和 `getConfig()` 管理默认配置。

## Fixes

- 修正自动列宽度、只读字段标签与内容布局及定位高亮样式。

## Improvements

本包导出的 `configureSchemx()`、`getConfig()`、`createForm()`、`useForm()` 继续绑定本包工厂，Registry 保持独立；被删除的是 Core 全局入口，不是本包默认配置方法。只读字段布局由 Vue Field 接管，保留原有显示效果。Vue 的 `SchemxLayout` 兼容别名仍保留，推荐使用 `SchemxColConfig` / `SchemxRowConfig`。

## Dependencies and Compatibility

本次属于上游 Core / Vue 公共 API 变化的已确认影响，需与兼容 Core 2.0 的框架与 UI 适配版本一起升级；本次未调整依赖版本范围。

## Documentation

更新根入口的兼容说明。全局配置、展示属性及 Renderer 类型的完整迁移方式见 [Core 2.0 迁移指南](../core/MIGRATION.md)。

## Theme Compatibility

Form 根节点自动绑定 `data-schemx-ui="element-plus"`，按适配边界映射宿主主题，降低多个适配包同页使用时的样式干扰。局部覆盖请直接设置对应组件变量；传送到表单外的弹层不自动继承表单局部变量，继续使用原生主题与样式入口。
