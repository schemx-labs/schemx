# @schemx/element-plus

基于 Vue 3 和 Element Plus 的 Schemx Renderer 适配包，提供预注册控件、表单布局默认值及远程选项支持。使用其他 UI 组件库或自研控件时，可改用 [`@schemx/vue`](../vue)。

## 安装

```bash
pnpm add @schemx/element-plus element-plus @element-plus/icons-vue vue
```

当前适配包要求 Element Plus `^2.14.0`、`@element-plus/icons-vue` `^2.3.1` 和 Vue `^3.0.0`。`@schemx/core` 与 `@schemx/vue` 会随适配包自动安装。

常规 ESM 构建会由 Schemx 根入口自动加载 Vue 基础样式和 Element Plus 适配样式，应用只需引入 Element Plus 自身样式：

```ts
import "element-plus/dist/index.css"
import SchemxForm from "@schemx/element-plus"
```

若使用 CommonJS，或构建工具未处理入口 CSS import，请按以下顺序显式导入：

```ts
import "element-plus/dist/index.css"
import "@schemx/vue/style.css"
import "@schemx/element-plus/style.css"
```

默认使用双列布局、右对齐标签、左对齐字段内容且不显示移动端分隔线；根入口会通过 `configureSchemx()` 写入模块级全局默认配置，可通过 Form Props 或 `ConfigProvider` 覆盖。

默认列宽配置为 `col.span = 12`，标签宽度为 `120`。Element Plus 使用独立的 Renderer Registry 和预设规则 Registry；最后导入的 UI 适配包会写入 Core 的模块级默认配置。混用多个适配包时，可通过 Form Props 或 `ConfigProvider` 分别设置 Registry、`rowComponent`、`colComponent` 和字段布局默认值。

若业务代码直接导入 `@schemx/vue`、`@schemx/core` 或其公开子路径（例如上面的 `@schemx/vue/style.css`），也应显式声明对应依赖。

根入口导出的 `rendererRegistry` 和 `presetRuleRegistry` 可用于扩展默认 Renderer 与规则。Form 配置、布局组件和 `ConfigProvider` 的用法见 [`@schemx/vue`](../vue)。

## 快速开始

导入适配包根入口即可使用已注册的 Renderer：

```vue
<script setup lang="ts">
  import { ref } from "vue"

  import SchemxForm, { type SchemxField } from "@schemx/element-plus"

  type ProfileValues = {
    name: string
    department: string
  }

  const values = ref<ProfileValues>({ name: "", department: "engineering" })

  const schemas: SchemxField<ProfileValues>[] = [
    { name: "name", label: "姓名", componentType: "input", required: true },
    {
      name: "department",
      label: "部门",
      componentType: "select",
      componentProps: {
        options: [
          { label: "研发", value: "engineering" },
          { label: "设计", value: "design" },
        ],
      },
    },
  ]
</script>

<template>
  <SchemxForm v-model="values" :schemas="schemas" />
</template>
```

## 支持的 Renderer

支持的 `componentType`：

```text
input
inputNumber
autocomplete
colorPicker
datetimePicker
inputTag
inputOtp
mention
switch
radio
checkbox
select
virtualizedSelect
datePicker
timePicker
timeSelect
treeSelect
cascader
sensitiveInput
rate
slider
upload
```

这些 Renderer 使用 Element Plus 的 `ElInput`、`ElInputNumber`、`ElAutocomplete`、`ElColorPicker`、`ElDatePicker`、`ElInputTag`、`ElInputOtp`、`ElMention`、`ElSwitch`、`ElRadioGroup`、`ElCheckboxGroup`、`ElSelect`、`ElSelectV2`、`ElTimePicker`、`ElTimeSelect`、`ElTreeSelect`、`ElCascader`、`ElRate`、`ElSlider` 和 `ElUpload` 实现。字段标签、校验、readonly/disabled 状态和远程字典仍由 Schemx 负责。

选项类 Renderer 使用对应 Element Plus 组件的 `options` 和 `props` 配置；以下 Renderer 另外支持 Schemx 的 `dict` 远程选项：`autocomplete`、`cascader`、`checkbox`、`mention`、`radio`、`select`、`treeSelect` 和 `virtualizedSelect`。Autocomplete 的 `props` 可映射建议项字段。`select`、`virtualizedSelect` 和 `treeSelect` 使用字符串、数字或布尔值作为单选值，多选值为数组。

`datetimePicker` 基于 `ElDatePicker`，默认 `type` 为 `datetime`，也支持 `datetimerange`。`virtualizedSelect` 基于 Element Plus `ElSelectV2`，适合大量选项场景；选项值、字段映射和远程字典用法与 `select` 一致。

`number`、`stepper`、`date`、`calendar`、`picker`、`selectPicker` 和 `selector` 不属于本适配包；其中 `number`/`stepper` 应迁移为 `inputNumber`，`date` 应迁移为 `datePicker`。

## 上传

上传字段值使用 Element Plus `UploadUserFile[]`（本包导出别名为 `UploadValue`）。可通过 `action` 使用 Element Plus 原生上传，也可以提供 `uploader(file)` 自定义请求。默认响应映射为 `{ data: "data", url: "url", name: "name" }`，对应下面的接口响应：

```json
{
  "data": {
    "url": "https://example.com/avatar.png",
    "name": "avatar.png"
  }
}
```

```ts
import type { SchemxField, UploadValue } from "@schemx/element-plus"

type ProfileValues = { avatar: UploadValue }

const avatarField: SchemxField<ProfileValues> = {
  name: "avatar",
  label: "头像",
  componentType: "upload",
  componentProps: {
    accept: "image/*",
    limit: 1,
    uploader: async (file) => {
      const body = new FormData()
      body.append("file", file)

      const response = await fetch("/api/upload", { method: "POST", body })
      if (!response.ok) throw new Error("上传失败")

      return response.json()
    },
  },
}
```

将 `avatarField` 放入表单的 `schemas`，并在 `initialValues` 或 `v-model` 中设置 `avatar: []`。接口使用其他字段名时，可通过 `componentProps.propsHttp` 配置 `data`、`url` 和 `name` 的映射；文件列表、上传完成和失败事件由 Renderer 同步到字段。

通用 Form Props、Slots 和 Composition API 见 [`@schemx/vue`](../vue)；Schema、动态字段和校验能力见 [`@schemx/core`](../core)。可运行示例见 [`examples/element-plus`](../../examples/element-plus)。
