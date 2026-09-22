# @schemx/element-plus

基于 Vue 3 和 Element Plus 的 Schemx Renderer 适配包，提供预注册控件、表单布局默认值及远程选项支持。使用其他 UI 组件库或自研控件时，可改用 [`@schemx/vue`](../vue)。

## 安装

```bash
pnpm add @schemx/element-plus element-plus @element-plus/icons-vue vue
```

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

默认列宽配置为 `col.span = 12`，标签宽度为 `120`。导入多个 UI 适配包时，最后执行的适配包配置会成为 Core 的模块级默认值；需要隔离配置时，请为各个 Form 显式传入 Registry 或使用 `ConfigProvider`。

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

`datetimePicker` 基于 `ElDatePicker`，默认 `type` 为 `datetime`，也支持 `datetimerange`。`virtualizedSelect` 基于 Element Plus `ElSelectV2`，适合大量选项场景；该组件在 Element Plus 中仍处于 testing 状态。

`inputOtp` 需要 Element Plus `^2.14.0` 或更高版本；该组件当前仍处于 beta 状态。

`number`、`stepper`、`date`、`calendar`、`picker`、`selectPicker` 和 `selector` 不属于本适配包；其中 `number`/`stepper` 应迁移为 `inputNumber`，`date` 应迁移为 `datePicker`。

## 上传

上传字段值使用 Element Plus `UploadUserFile[]`。自定义上传函数通过 `uploader` 映射到 Element Plus 的 `http-request`：

```ts
{
  name: "avatar",
  componentType: "upload",
  componentProps: {
    accept: "image/*",
    uploader: async (file) => uploadFile(file),
  },
}
```

通用 Form Props、Slots 和 Composition API 见 [`@schemx/vue`](../vue)；Schema、动态字段和校验能力见 [`@schemx/core`](../core)。可运行示例见 [`examples/element-plus`](../../examples/element-plus)。
