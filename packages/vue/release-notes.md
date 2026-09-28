# Release Notes — 1.1.1

## 版本信息

- 目标版本：1.1.1
- 发布包：@schemx/vue
- 生成日期：2026-09-26
- 基准版本：@schemx/vue@1.1.0
- 比较范围：8c83a9e5e9f1b4bfa36e8e699eec3720b69fa45a..468f48e9c698084bd7ad9bf7a26d93493ef582f4
- 目标提交：468f48e
- 当前分支：dev

字段内容现在继承基础字号，与标签保持一致。

## Fixes

### @schemx/vue

- <a id="change-7675652d6669656c642d666f6e742d73697a652d696e6865726974616e6365"></a>Field 基础字号从标签节点移到字段容器，Renderer 内容现在与标签统一使用 `--schemx-font-size-md`。（影响范围：Vue 字段中的控件内容会继承 Schemx 基础字号，减少标签与控件字号不一致。）

## Affected Packages

- @schemx/vue
