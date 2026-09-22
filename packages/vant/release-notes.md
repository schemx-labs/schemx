# Release Notes — 1.0.1

## 版本信息

- 目标版本：1.0.1
- 发布包：@schemx/vant
- 生成日期：2026-09-23
- 基准版本：@schemx/vant@1.0.1
- 比较范围：13c230bee8254718e8137166cf349b0570ad0759..333ac2b9f85bf4d62800cfb04f6b00e8fc3e2fad
- 目标提交：333ac2b
- 当前分支：dev

Vant 适配包新增移动端默认布局、字段展示和主题映射。

## Important Notices

- 导入 `@schemx/vant` 会通过 `configureSchemx` 替换 Core 模块级全局配置并设置 Vant 默认能力；App、ConfigProvider 或 Form 级配置可以覆盖这些默认值。

## Features

### @schemx/vant

- <a id="change-76616e742d64656661756c742d6c61796f7574"></a>导入 Vant 适配包后，默认 Renderer、Vant Row/Col 与移动端字段布局会自动配置；默认列宽为 24，gutter 为零，并设置 Vant 风格的标签、错误对齐和底部边框。（影响范围：使用 `@schemx/vant` 默认布局和字段样式的应用。）

## Improvements

### @schemx/vant

- <a id="change-76616e742d7468656d652d7661726961626c6573"></a>新增主题变量，将 Schemx 颜色、文字、禁用态、间距、字号和圆角映射到 Vant CSS 变量，并为表单、字段、分组和弹层控件补充移动端样式。（影响范围：使用 Vant 主题或自定义 Vant CSS 变量的应用。）

## Affected Packages

- @schemx/vant
