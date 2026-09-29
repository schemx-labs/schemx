# Release Notes — 0.0.1

## 版本信息

- 目标版本：0.0.1
- 发布包：@schemx/element-plus
- 生成日期：2026-09-29
- 基准版本：v0.1.20
- 比较范围：775dca01e5881121673f028dbb5d3e31e33d3587..61c5b35351d301d48bf8496044a576619f270446
- 目标提交：61c5b35
- 当前分支：main

Element Plus 0.0.1 提供完整的表单 Renderer 适配，并包含上传预览、字段定位和分组过渡能力。

## Features

### @schemx/element-plus

- <a id="change-72656e64657265722d616461707465722d666f756e646174696f6e"></a>0.0.1 首次提供 Element Plus 控件 Renderer，覆盖输入、选项、日期时间、选择器、上传和只读展示；支持 options、props、dict 适配及 Element Plus 事件与插槽转发。（影响范围：Vue 3 表单可直接使用预注册的 Element Plus Renderer 与适配层默认布局。）

- <a id="change-75706c6f61642d707265766965772d76616c69646174696f6e"></a>Upload Renderer 支持图片与非图片文件连续预览、自定义预览和下载；读取前按 accept 扩展名与 MIME 规则拒绝不匹配文件。（影响范围：上传文件可统一预览和操作，accept 限制由组件在读取前执行。）

- <a id="change-7363726f6c6c2d746f2d6669656c64"></a>适配包根入口重导出 Vue 表单 API；Form 实例可使用 scrollToField 定位字段，并自动展开折叠的祖先 Group。（影响范围：可通过 Element Plus Form ref 定位表单字段。）

- <a id="change-63616c6c6261636b2d666f726d2d6170692d6d6574686f6473"></a>传给动态 Schema 回调的 SchemxFormApi 现在包含 isLoading 和 clearErrors。（影响范围：动态回调可读取提交状态并清除全部表单错误。）

## Improvements

### @schemx/element-plus

- <a id="change-73656e7369746976652d696e7075742d6265686176696f72"></a>非只读状态下敏感输入始终使用输入框，避免隐藏态切换改变交互控件。（影响范围：敏感字段切换显示状态时仍保持可编辑输入交互。）

- <a id="change-63686f6963652d72656e64657265722d73706163696e67"></a>Element Plus Radio 与 Checkbox Renderer 使用更明确的行列间距，并移除控件默认右边距。（影响范围：换行显示的单选和多选选项间距更一致。）

- <a id="change-67726f75702d636f6c6c617073652d7472616e736974696f6e"></a>共享 Vue Group 现在使用 max-height 过渡，并在收起完成后隐藏 Body；Element Plus 主题变量同时提供箭头颜色和尺寸。（影响范围：Element Plus 表单的折叠分组具有高度过渡和适配主题的线条箭头。）

## API Changes

- [提供 Element Plus 表单 Renderer 适配](#change-72656e64657265722d616461707465722d666f756e646174696f6e) (@schemx/element-plus)
- [通过 Element Plus 表单实例定位字段](#change-7363726f6c6c2d746f2d6669656c64) (@schemx/element-plus)
- [扩展动态回调的表单操作方法](#change-63616c6c6261636b2d666f726d2d6170692d6d6574686f6473) (@schemx/element-plus)

## TypeScript Changes

- [扩展动态回调的表单操作方法](#change-63616c6c6261636b2d666f726d2d6170692d6d6574686f6473) (@schemx/element-plus)

## Dependencies and Compatibility

- <a id="change-656c656d656e742d706c75732d706565722d72616e6765"></a>适配包要求 element-plus ^2.14.0。（影响范围：安装 @schemx/element-plus 时需要使用受支持范围内的 Element Plus 版本。）

## Affected Packages

- @schemx/element-plus
