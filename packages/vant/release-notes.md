# Release Notes — 1.1.1

## 版本信息

- 目标版本：1.1.1
- 发布包：@schemx/vant
- 生成日期：2026-09-26
- 基准版本：@schemx/vant@1.1.0
- 比较范围：8c83a9e5e9f1b4bfa36e8e699eec3720b69fa45a..468f48e9c698084bd7ad9bf7a26d93493ef582f4
- 目标提交：468f48e
- 当前分支：dev

修复 Vant 字段内容对齐，并在上传读取前校验 accept 文件类型。

## Features

### @schemx/vant

- <a id="change-76616e742d75706c6f61642d6163636570742d656e666f7263656d656e74"></a>Vant UploadRenderer 按 `accept` 的扩展名、MIME 类型和 MIME 通配规则检查所选文件；不匹配时会阻止读取并提示支持格式，不会调用自定义 `beforeRead`。（影响范围：为 Vant UploadRenderer 配置 `accept` 后，该限制会由组件在运行时强制执行。）

## Fixes

### @schemx/vant

- <a id="change-76616e742d6669656c642d636f6e74656e742d616c69676e6d656e74"></a>输入、文本域、单选、多选、选择器与开关 Renderer 现在应用字段 `contentAlign`；Vant 默认内容对齐由左改为右。（影响范围：使用 Vant 默认布局的表单将看到右对齐的字段内容；需要保留左对齐时，可将 Form 的 `contentAlign` 设为 `left`。）

## Affected Packages

- @schemx/vant
