# Release Notes — 1.0.1

## Unreleased

### @schemx/vant

- 显式声明移动端单列、对齐与分隔线默认值，并接管原本位于 Vue 包的移动端卡片和 Group 视觉样式。
- Schemx 语义 Token 映射到 Vant CSS 变量，同时覆盖 Teleport 到 `body` 的 Picker、Calendar 和 Cascader Popup。
- 普通字段默认左对齐内容，只读字段自动切换为右对齐，标签默认右对齐。

## 版本信息

- 目标版本：1.0.1
- 发布包：@schemx/vant
- 生成日期：2026-09-11
- 基准版本：@schemx/vant@1.0.0
- 比较范围：9696a15daf708ed8f1438f4cf3324e50019f95b1..a62db33c25a2d43a9a071eec8748f75ad09d477a
- 目标提交：a62db33
- 当前分支：main

1.0.1 统一 Vant 内置 Renderer 与 @schemx/vue 的 Props 类型契约，确保 Core、Vue、Vant 的值、事件和状态类型边界一致。

## Important Notices

- 目标提交尚未创建匹配的 @schemx/vant@1.0.1 Tag；目标版本取自目标提交中的 package.json。
- Vant 依赖 @schemx/vue 与 @schemx/core 的公共类型，建议三包同步升级至 1.0.1。

## Improvements

### @schemx/vant

- <a id="change-76616e742d7675652d72656e64657265722d70726f7073"></a>Input、Calendar、Cascader、Checkbox、Date、Picker、Radio、Rate、SelectPicker、Selector、Slider、Stepper、Switch 和 Upload 等 Renderer Props 改用 @schemx/vue 的 SchemxBaseComponentProps。（影响范围：直接引用 Vant Renderer Props 或维护自定义 Vue Renderer 类型的 TypeScript 项目，可使用同一套 Vue 值、事件、状态和公共 Props 契约。）

## Documentation

### @schemx/vant

- <a id="change-76616e742d6170692d646f63756d656e746174696f6e"></a>Vant README 同步统一 Form Context、Vue Renderer Props、适配层扩展点和配置入口的公开 API 清单。（影响范围：使用 Vant 内置 Renderer、Dictionary 或自定义 Renderer 的开发者可以按新的 Vue Context 和 Props 类型入口配置项目。）

## API Changes

- [统一 Vant Renderer 的 Vue Props 基类](#change-76616e742d7675652d72656e64657265722d70726f7073) (@schemx/vant)
- [更新 Vant Context 与类型参考](#change-76616e742d6170692d646f63756d656e746174696f6e) (@schemx/vant)

## TypeScript Changes

- [统一 Vant Renderer 的 Vue Props 基类](#change-76616e742d7675652d72656e64657265722d70726f7073) (@schemx/vant)
- [更新 Vant Context 与类型参考](#change-76616e742d6170692d646f63756d656e746174696f6e) (@schemx/vant)

## Affected Packages

- @schemx/vant
