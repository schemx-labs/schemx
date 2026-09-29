# Release Notes — 1.1.2

## 版本信息

- 目标版本：1.1.2
- 发布包：@schemx/vant
- 生成日期：2026-09-29
- 基准版本：@schemx/vant@1.1.1
- 比较范围：468f48e9c698084bd7ad9bf7a26d93493ef582f4..61c5b35351d301d48bf8496044a576619f270446
- 目标提交：61c5b35
- 当前分支：main

Vant 通过共享 Vue 表单 API 支持字段定位和折叠 Group 过渡。

## Breaking Changes

<a id="change-696e7374616e63652d747970652d657874656e73696f6e"></a>

### 实例类型扩展改用专用声明入口 (@schemx/vant)

适配包重新导出 Core 和 Vue 表单类型；SchemxInstance 扩展现在通过 SchemxInstanceDefinition 声明，动态回调的 SchemxFormApi 仅包含 Core 实际提供的方法。

影响范围：通过 Vant 根入口扩展 Core 实例类型的 TypeScript 适配层需要迁移声明。

#### 迁移说明

影响范围：通过模块声明合并扩展 @schemx/core 的 SchemxInstance 或 SchemxFormApi 类型

1. 把框架实例方法的声明合并迁移到 SchemxInstanceDefinition<TValues>。
2. 在 Core Schema 回调中只调用 SchemxFormApi 声明且运行时实际提供的方法。
3. 在 Vue 层通过 Vue 表单实例或组件 ref 调用 scrollToField。
4. 若自定义回调需要额外方法，请同步定义回调类型并注入真实运行时实现。

## Features

### @schemx/vant

- <a id="change-7363726f6c6c2d746f2d6669656c64"></a>适配包根入口重导出 Vue 表单 API，因此 useForm 返回的实例和 Form 组件实例 ref 可使用 scrollToField，并自动展开折叠的祖先 Group。（影响范围：Vant 表单可在校验失败或业务操作后定位目标字段。）

- <a id="change-63616c6c6261636b2d666f726d2d6170692d6d6574686f6473"></a>传给动态 Schema 回调的 SchemxFormApi 现在包含 isLoading 和 clearErrors。（影响范围：动态回调可读取提交状态并清除全部表单错误。）

## Improvements

### @schemx/vant

- <a id="change-67726f75702d636f6c6c617073652d7472616e736974696f6e"></a>共享 Vue Group 通过 max-height 和贝塞尔曲线过渡展开、收起；完全收起后隐藏 Body，减少动态效果偏好会缩短过渡。（影响范围：Vant 表单中的折叠分组现在带有展开和收起过渡。）

## API Changes

- [通过适配包实例定位字段](#change-7363726f6c6c2d746f2d6669656c64) (@schemx/vant)
- [扩展动态回调的表单操作方法](#change-63616c6c6261636b2d666f726d2d6170692d6d6574686f6473) (@schemx/vant)

## TypeScript Changes

- [实例类型扩展改用专用声明入口](#change-696e7374616e63652d747970652d657874656e73696f6e) (@schemx/vant)
- [扩展动态回调的表单操作方法](#change-63616c6c6261636b2d666f726d2d6170692d6d6574686f6473) (@schemx/vant)

## Affected Packages

- @schemx/vant
