# @schemx/element-plus Release Notes

## Unreleased

- 新增 autocomplete、colorPicker、datetimePicker、inputTag、inputOtp、mention、select、virtualizedSelect、timePicker、timeSelect 和 treeSelect Renderer。
- 新增选项字段的 `options`、`props`、`dict` 适配，以及只读展示、关键事件和 Element Plus 插槽转发。
- Element Plus peerDependency 最低版本提升至 `^2.14.0`。
- 显式声明 PC 双列布局和字段对齐默认值，并将 Schemx 语义 Token 映射到 Element Plus CSS 变量。
- 新增只读字段内容右对齐的默认呈现，普通字段内容保持左对齐。

## 1.0.1

- 新增基于 Element Plus 原生表单组件的 Schemx Renderer 适配包。
- 支持 input、inputNumber、switch、radio、checkbox、datePicker、cascader、sensitiveInput、rate、slider 和 upload。
- 使用 Element Plus `UploadUserFile`、自定义 `http-request` 和图片预览能力完成上传字段适配。
- 移除 calendar、picker、selectPicker、selector，并将 number、stepper 合并为 inputNumber。
