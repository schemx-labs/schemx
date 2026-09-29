# Release Notes — 1.2.0

## 版本信息

- 目标版本：1.2.0
- 发布包：@schemx/vue
- 生成日期：2026-09-29
- 基准版本：@schemx/vue@1.1.1
- 比较范围：468f48e9c698084bd7ad9bf7a26d93493ef582f4..61c5b35351d301d48bf8496044a576619f270446
- 目标提交：61c5b35
- 当前分支：main

Vue 表单实例新增字段定位，可展开折叠 Group 后滚动；Group 展开和收起现带高度过渡。

## Breaking Changes

<a id="change-696e7374616e63652d747970652d657874656e73696f6e"></a>

### 实例类型扩展改用专用声明入口 (@schemx/vue)

SchemxInstance 和 SchemxFormApi 从可声明合并的接口改为类型别名。Vue 的实例扩展通过 SchemxInstanceDefinition 提供；动态回调的 SchemxFormApi 不包含 Vue DOM 方法。

影响范围：直接扩展这些接口声明的 TypeScript 项目需要调整；在动态回调中调用 scrollToField 会被类型检查拒绝。

#### 迁移说明

影响范围：通过模块声明合并扩展 @schemx/core 的 SchemxInstance 或 SchemxFormApi 类型

1. 把框架实例方法的声明合并迁移到 SchemxInstanceDefinition<TValues>。
2. 在 Core Schema 回调中只调用 SchemxFormApi 声明且运行时实际提供的方法。
3. 在 Vue 层通过 Vue 表单实例或组件 ref 调用 scrollToField。
4. 若自定义回调需要额外方法，请同步定义回调类型并注入真实运行时实现。

## Features

### @schemx/vue

- <a id="change-7363726f6c6c2d746f2d6669656c64"></a>Vue 表单实例新增 scrollToField(name, options)，可定位动态字段并依次展开折叠的祖先 Group。默认平滑滚动并将字段垂直居中；字段不可见、未渲染或无法展开时返回 false。（影响范围：表单可直接定位可见字段；目标位于折叠分组时会先展开祖先分组。）

- <a id="change-63616c6c6261636b2d666f726d2d6170692d6d6574686f6473"></a>传给动态 Schema 回调的 SchemxFormApi 现在包含 isLoading 和 clearErrors。（影响范围：动态回调可读取提交状态并清除全部表单错误。）

## Improvements

### @schemx/vue

- <a id="change-67726f75702d636f6c6c617073652d7472616e736974696f6e"></a>Group Body 使用 max-height 和贝塞尔曲线过渡；动画结束后以 display: none 隐藏。减少动态效果偏好会缩短过渡，destroyOnCollapse 开启时子组件在收起动画后卸载。（影响范围：可折叠分组的展开和收起现在带有平滑高度过渡。）

## API Changes

- [新增 scrollToField 字段定位](#change-7363726f6c6c2d746f2d6669656c64) (@schemx/vue)
- [扩展动态回调的表单操作方法](#change-63616c6c6261636b2d666f726d2d6170692d6d6574686f6473) (@schemx/vue)

## TypeScript Changes

- [新增 scrollToField 字段定位](#change-7363726f6c6c2d746f2d6669656c64) (@schemx/vue)
- [实例类型扩展改用专用声明入口](#change-696e7374616e63652d747970652d657874656e73696f6e) (@schemx/vue)
- [扩展动态回调的表单操作方法](#change-63616c6c6261636b2d666f726d2d6170692d6d6574686f6473) (@schemx/vue)

## Dependencies and Compatibility

- <a id="change-7363726f6c6c2d696e746f2d766965772d646570656e64656e6379"></a>Vue 包新增 scroll-into-view-if-needed 依赖，用于按需将字段滚动到可见区域。（影响范围：安装 @schemx/vue 时会一并安装字段定位所需的滚动依赖。）

## Affected Packages

- @schemx/vue
