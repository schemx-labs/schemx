# @schemx/element-plus

所有公开 API 和类型均从包根入口导入；仅样式保留 `style.css` 资源子路径。

基于 Vue 3 和 Element Plus 的 Schemx Renderer 适配包，提供预注册控件、表单布局默认值及远程选项支持。使用其他 UI 组件库或自研控件时，可改用 [`@schemx/vue`](../vue)。

本包内部使用 `@schemx/vue` 的 `createSchemx` 管理配置、Registry 与表单创建；组件、`ConfigProvider` 和插件安装由独立模块提供，根入口通过 `export *` 透传 `@schemx/vue` 的公共 API 和类型，包括 `createSchemx`；Form、`createForm`、`configureSchemx`、`getConfig`、`useForm`、默认配置与 Registry 使用本包实现。工厂类型与组件接入函数均可从本包根入口导入。`configureSchemx(options)` 每次替换本包覆盖层，仅影响新表单；无参数恢复 UI 默认配置。`getConfig()` 读取本包默认配置。Registry 引用固定，注册内容通过导出的 Registry 修改。

UI 根入口同步保留 Vue 的 `getGlobalSchemxConfig`、`mergeSchemxConfig` 和 `SchemxLayout` 兼容导出；推荐分别使用 `getConfig`、`mergeConfig` 和 `SchemxColConfig`。已发布的旧 Context API 保留并标为弃用；推荐使用 `provideFormContext`、`useFormContextValue`、`createFieldContext`、`useFieldContext` 和 `useConfigProviderContextRef`。旧 Form 提供函数改用 `provideFormContext`，旧实例/配置读取函数改从 `useFormContextValue()` 读取，旧 Provider 提供函数改用 `ConfigProvider`。组件、`useForm` 及默认配置的调用方式保持不变。本包的 Form 通过 `@schemx/vue` 绑定创建器，不向嵌套普通 Form 传播工厂。

工厂默认值、App、`ConfigProvider` 和表单局部选项均支持 `debug`、`schedulerOptions`、`validationConcurrency`。局部选项优先，显式 `debug: false` 可关闭继承值；调度对象整体替换，并保存独立快照。这些选项只在创建时生效，更新配置不会重配已有表单。共享配置过滤实例数据、生命周期及业务回调，单次创建选项不受影响。

`ConfigProvider`、App 安装配置和配置上下文函数与 Vue 共用普通上下文，对同一组件树中的所有 UI 包生效，不接受工厂作用域。同一 App 后一次显式安装配置替换根配置；不同 App 的上下文保持隔离。`row`、`col` 与调度对象整体替换，不继承低层对象属性。

包内默认实例仍共享；多业务模块或 SSR 请求需要独立配置时，通过 Vue 工厂创建实例，再由基础 Vue Hook 接入：

```ts
import { createSchemx, useForm } from "@schemx/vue"
import { defaultConfig } from "@schemx/element-plus"

const schemx = createSchemx(defaultConfig)
const form = useForm({ initialValues: { name: "" } }, schemx.createForm)
```

本包公开 `defaultConfig` 只声明 UI 自有设置；Vue 工厂自动补入框架默认值。两个 UI 包各创建一个实例，`configureSchemx` 互不影响，同一包消费端仍共享默认配置。工厂不读取 Core 全局配置；示例中的 `defaultConfig` 携带本包 Registry，因此新工厂仍共享其注册内容；需要隔离时应另建并注册 Renderer 和规则。已有表单捕获创建默认值，后续工厂更新不影响它；Provider/Props 的展示更新和撤销仍按固定创建基线处理。

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

入口组件和本包的 `useForm` 自动提供 Renderer、Row/Col 及字段默认配置；直接导入并使用组件即可，无需安装整份 `defaultConfig`。字段默认单列布局（`col.span = 24`）、右对齐标签、标签宽度 `120`、左对齐内容且不显示移动端分隔线。操作区默认 `{ span: 12, offset: 6 }`，可通过 `actionCol` Prop 或共享配置的 `schemaConfig.actionCol` 覆盖。

组件 Props 或 Hook 选项优先于外部 `ConfigProvider`/App 配置，外部配置优先于 UI 默认值。插件安装只提供调用方的 App 配置：

```ts
import SchemxForm from "@schemx/element-plus"

app.use(SchemxForm, { schemaConfig: { labelWidth: 140 } })
```

导入适配包不会修改 Core 全局配置或 Vue Registry。Element Plus 与其他 UI 包使用独立 Registry；同一包的默认 Registry 仍可通过导出实例扩展。无参数 `app.use(SchemxForm)` 仅注册组件，不清除 App 已有配置。

本包的 `createForm` 自动使用 Element Plus 默认配置，可以在 Vue 生命周期之外同步创建表单，并由调用方销毁：

```ts
import { createForm } from "@schemx/element-plus"

const form = createForm({ initialValues: { name: "" } })
```

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
