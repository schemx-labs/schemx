# @schemx/vant

`@schemx/vant` 是 Schemx 的 Vant 4 Renderer 集合。根入口提供 Vant Renderer、Registry 和布局组件，并重新导出 Vue 与 Core 的公开 API；导入根入口时会通过 `configureSchemx()` 写入 Vant 的模块级全局默认配置，也可以通过 Form Props 或 `ConfigProvider` 覆盖。

适用于 Vue 3 + Vant 4 的移动端 Schema 表单。使用 Element Plus 时请改用 [`@schemx/element-plus`](../element-plus)；使用其他组件库或自研控件时，可使用 [`@schemx/vue`](../vue) 并自行注册 Renderer。

`@schemx/vant` 不导出独立的 `Cell` 公共组件；内置弹窗 Renderer 使用 Vant 的 `Cell`，自定义 Renderer 的只读 / 禁用状态包装请使用 `@schemx/vue` 的 `Wrapper`。

## 安装

```bash
pnpm add @schemx/vant vant vue
```

`@schemx/vue` 和 `@schemx/core` 会随 `@schemx/vant` 自动安装；`vant` 和 `vue` 是 peer dependencies，需要由业务项目显式安装。Schemx 的样式由 ESM 根入口自动加载；Vant 自身样式需按项目现有方案加载：

```ts
import "vant/lib/index.css"
```

若使用 CommonJS，或构建工具未处理入口 CSS import，请显式导入：

```ts
import "vant/lib/index.css"
import "@schemx/vue/style.css"
import "@schemx/vant/style.css"
```

样式顺序为“Vant 基础样式 → Schemx Vue 结构样式 → Vant 适配样式”。Vant 适配包默认使用单列布局、标签右对齐、字段内容和校验错误右对齐，并使用移动端分隔线；可通过 Form Props 或 `ConfigProvider` 覆盖。

若业务代码直接导入 `@schemx/vue`、`@schemx/core` 或其公开子路径（例如 `@schemx/vue/style.css`），也应在项目中显式声明对应包。

## 快速开始

```vue
<script setup lang="ts">
  import { ref } from "vue"

  import Schemx from "@schemx/vant"
  import type { SchemxField } from "@schemx/vant"

  type ProfileValues = {
    name: string
    city: string
    notification: boolean
  }

  const modelValue = ref<ProfileValues>({
    name: "",
    city: "",
    notification: true,
  })

  const schemas: SchemxField<ProfileValues>[] = [
    {
      name: "name",
      label: "姓名",
      componentType: "input",
      required: true,
      componentProps: {
        placeholder: "请输入姓名",
        clearable: true,
      },
    },
    {
      name: "city",
      label: "城市",
      componentType: "picker",
      componentProps: {
        options: [
          { text: "杭州", value: "hangzhou" },
          { text: "上海", value: "shanghai" },
        ],
      },
    },
    {
      name: "notification",
      label: "接收通知",
      componentType: "switch",
    },
  ]
</script>

<template>
  <Schemx v-model="modelValue" :schemas="schemas" />
</template>
```

## Group 与 Dependency 容器

Vant 适配层直接消费 Core 解析后的容器状态，因此 Group 和 Dependency 均可统一控制后代 Vant Renderer 的可见、只读和禁用状态。折叠只属于 Group 的展示行为，不会改变字段值或校验语义。

```ts
const schemas: SchemxField[] = [
  { name: "editable", label: "允许编辑", componentType: "switch", initialValue: true },
  {
    key: "shipping",
    label: "配送信息",
    collapsible: true,
    destroyOnCollapse: false,
    dependencies: {
      triggerFields: ["editable"],
      readonly: (values) => !values.editable,
    },
    children: [{ name: "address", label: "地址", componentType: "input" }],
  },
]
```

Dependency 使用 `to` 生成或更新动态子树，使用 `dependencies` 改变整棵子树状态；两条链路相互独立。容器 dependencies 只支持 `visible`、`readonly`、`disabled`，不支持字段 dependencies 的 `trigger`、`rules` 或 `componentProps`。可运行的操作示例见 [Vant 示例项目](../../examples/vant) 中的“动态表单”和“字段联动”。

### 动态数组

Dynamic 数组字段使用必填的 `key`、数组路径 `name` 和行模板 `item`。`item` 中的普通字段和 Group 使用相对路径，Vant 表单会根据当前数组索引渲染每一行；新增、删除和移动通过 `setFieldValue(path, updater)` 操作数组值。

```ts
import { useForm, type SchemxField } from "@schemx/vant"

type Member = { name: string; role: "developer" | "designer" }
type TeamValues = { members: Member[] }

const schemas: SchemxField<TeamValues>[] = [
  {
    key: "members",
    name: "members",
    label: "团队成员",
    item: [
      {
        key: "member",
        label: "成员信息",
        children: [
          { name: "name", label: "姓名", componentType: "input" },
          {
            name: "role",
            label: "角色",
            componentType: "selector",
            componentProps: {
              options: [
                { label: "开发", value: "developer" },
                { label: "设计", value: "designer" },
              ],
            },
          },
        ],
      },
    ],
  },
]

const form = useForm<TeamValues>({
  initialValues: { members: [{ name: "张三", role: "developer" }] },
  schemas,
})

form.setFieldValue("members", (members) => [
  ...(members ?? []),
  { name: "李四", role: "designer" },
])
```

Dynamic 容器的 `visible`、`readonly`、`disabled` 和 `dependencies` 会递归作用于每行的后代字段。行内模板可以包含普通字段、Group 和 Dependency，但不能嵌套 Dynamic；行内 Dependency 的 `to` 使用完整表单路径，`renderer` 返回的子 Schema 使用当前行相对路径。Vant 不会自动提供数组操作按钮，业务代码需要自行实现。

## Renderer 总览

下表按 `DEFAULT_RENDERER_TYPES` 的顺序列出内置 Renderer。「完整支持」表示可在 Schema 的 `componentProps.dict` 中配置远程选项。

| `componentType`  | 导出组件                 | Value 类型            | Option 类型                           | Dictionary | 主要 Vant 组件                                       |
| ---------------- | ------------------------ | --------------------- | ------------------------------------- | ---------- | ---------------------------------------------------- |
| `input`          | `InputRenderer`          | `InputValue`          | —                                     | 不支持     | Vant `Field`                                         |
| `text`           | `TextRenderer`           | `TextValue`           | —                                     | 不支持     | Vant `Field`、`Icon`                                 |
| `textarea`       | `TextAreaRenderer`       | `TextAreaValue`       | —                                     | 不支持     | Vant `Field`                                         |
| `number`         | `NumberRenderer`         | `NumberValue`         | —                                     | 不支持     | Vant `Field`                                         |
| `switch`         | `SwitchRenderer`         | `SwitchValue`         | —                                     | 不支持     | Vant `Switch`                                        |
| `radio`          | `RadioRenderer`          | `RadioValue`          | `RadioOption`                         | 完整支持   | Vant `RadioGroup`、`Radio`                           |
| `checkbox`       | `CheckboxRenderer`       | `CheckboxValue`       | `CheckboxOption`                      | 完整支持   | Vant `CheckboxGroup`、`Checkbox`                     |
| `date`           | `DateRenderer`           | `DateValue`           | —                                     | 不支持     | Vant `DatePicker`、`Popup`、`Cell`                   |
| `calendar`       | `CalendarRenderer`       | `CalendarValue`       | —                                     | 不支持     | Vant `Calendar`、`Cell`                              |
| `picker`         | `PickerRenderer`         | `PickerValue`         | Vant `PickerOption`（未从本包导出）   | 完整支持   | Vant `Picker`、`Popup`、`Cell`                       |
| `selectPicker`   | `SelectPickerRenderer`   | `SelectPickerValue`   | `SelectPickerOption`                  | 完整支持   | Vant `Popup`、`Checkbox` / `Radio`、`Button`、`Cell` |
| `selector`       | `SelectorRenderer`       | `SelectValue`         | `SelectorOption`                      | 完整支持   | 包内 `Selector`                                      |
| `sensitiveInput` | `SensitiveInputRenderer` | `SensitiveInputValue` | —                                     | 不支持     | Vant `Field`、`Icon`                                 |
| `rate`           | `RateRenderer`           | `RateValue`           | —                                     | 不支持     | Vant `Rate`                                          |
| `slider`         | `SliderRenderer`         | `SliderValue`         | —                                     | 不支持     | Vant `Slider`                                        |
| `stepper`        | `StepperRenderer`        | `StepperValue`        | —                                     | 不支持     | Vant `Stepper`                                       |
| `upload`         | `UploadRenderer`         | `UploadValue`         | `UploadFile`（文件项）                | 不支持     | Vant `Uploader`、`ImagePreview`                      |
| `cascader`       | `CascaderRenderer`       | `CascaderValue`       | Vant `CascaderOption`（未从本包导出） | 完整支持   | Vant `Cascader`、`Popup`、`Cell`                     |

全部 Renderer 都接受 Schemx 字段上下文提供的基础契约。下文只列继承来源、排除或重写字段，以及本包显式增加的字段；Vant 的完整通用 Props 请查阅 Vant 文档。

## Dictionary

### 支持范围与优先级

`radio`、`checkbox`、`picker`、`selectPicker`、`selector`、`cascader` 在类型与运行时都支持 `dict`。`WithRemoteOptions` 在存在 `dict` 时调用 `useDictionary`，把结果注入为 `options`，并注入 `loading`；此时远程结果替代静态 `options`。没有 `dict` 时直接使用传入的静态 `options`。

`cascader` 的根导出通过 `WithRemoteOptions` 包装，静态 `options` 和 Dictionary 产生的远程选项都会传给 Vant `<Cascader>`，也会用于展示标签路径映射。其 Schema 类型同样注入了 `SchemxWithDictionary`，因此可以像其他支持 Dictionary 的选择 Renderer 一样配置 `dict`。

### `SchemxDictionary` 字段

| 字段                | 类型                                             | 默认值   | 说明                                                                                                 |
| ------------------- | ------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------- |
| `api`               | `(values, form, signal?) => R \| Promise<R>`     | 必填     | 获取原始数据；接收当前表单值、实例和可选的 `AbortSignal`。                                           |
| `formatter`         | `(res, form) => TOption[] \| Promise<TOption[]>` | —        | 把 API 响应转换为 Renderer 所需的选项数组。                                                          |
| `dependsOn`         | `NamePath[]`                                     | —        | 依赖字段变化后重新加载。                                                                             |
| `shouldFetch`       | `(values) => boolean`                            | 始终执行 | 返回 `false` 时跳过请求并清空选项。                                                                  |
| `immediate`         | `boolean`                                        | `true`   | 是否在挂载后立即加载。                                                                               |
| `resetOnDepsChange` | `boolean`                                        | `false`  | 依赖变化时清空当前字段；Vant 内建 Dictionary Renderer 会自动从 `Field` 的字段 Context 取得目标路径。 |
| `retryCount`        | `number`                                         | `0`      | 失败重试次数。                                                                                       |
| `retryInterval`     | `number`                                         | `1000`   | 重试间隔，单位为毫秒。                                                                               |
| `onSuccess`         | `(data, form) => void`                           | —        | 格式化并写入选项后触发。                                                                             |
| `onError`           | `(error, form) => void`                          | —        | 最终失败后触发。                                                                                     |
| `onDepsChange`      | `(values, form) => void`                         | —        | 依赖变化后、`shouldFetch` 判断前触发。                                                               |

每次 `loadDict()` 都会递增请求计数并中止上一次仍在进行的请求。`api` 声明第三个参数时会收到当前请求的 `AbortSignal`；重试等待也可被中止。过期请求的成功结果、异步 `formatter` 结果和错误都不会写入当前状态；`shouldFetch` 返回 `false` 时会清空选项并结束加载。底层 API 是否真正停止仍取决于它是否使用 `AbortSignal`，不要把请求中止等同于业务服务端已经取消处理。

`resetOnDepsChange` 仍以 `useDictionary(options, fieldName)` 的第二参数作为底层重置目标。支持 Dictionary 的 Vant Renderer 经 `WithRemoteOptions` 包装后，会在 `Field` 内自动从字段 Context 取得当前 Schema 字段路径，因此严格类型的 Schema 只需配置 `dict`，无需声明或传入内部 `fieldName`。自定义 Renderer 若直接调用 `useDictionary()`，或将 HOC 脱离 `Field` 使用，仍可显式传入 `fieldName`。此边界与 `@schemx/vue` README 的 `useDictionary` / `WithRemoteOptions` 说明一致。

### 可复制的依赖联动示例

```ts
import type { SchemxField } from "@schemx/vant"

type AddressValues = {
  province: string
  city: string
}

type CityResponse = {
  id: string
  name: string
}[]

export const addressSchemas: SchemxField<AddressValues>[] = [
  {
    name: "province",
    label: "省份",
    componentType: "picker",
    componentProps: {
      options: [
        { text: "浙江", value: "zhejiang" },
        { text: "江苏", value: "jiangsu" },
      ],
    },
  },
  {
    name: "city",
    label: "城市",
    componentType: "selectPicker",
    componentProps: {
      type: "radio",
      dict: {
        api: async (values: AddressValues): Promise<CityResponse> => {
          const response = await fetch(`/api/cities?province=${values.province}`)
          return response.json()
        },
        formatter: (rows: CityResponse) =>
          rows.map((row) => ({ label: row.name, value: row.id })),
        dependsOn: ["province"],
        shouldFetch: (values: AddressValues) => Boolean(values.province),
      },
    },
  },
]
```

## Schema

`@schemx/vant` 重新导出 `SchemxField` 与 Core 的所有类型。Schema 有 4 种结构：

| 类型         | 关键字段                                           | 用途                                 |
| ------------ | -------------------------------------------------- | ------------------------------------ |
| 普通字段     | `name`、`label`、`componentType`、`componentProps` | 使用一个 Vant Renderer 渲染字段。    |
| 分组字段     | `label`、`children`、`collapsible`、`collapsed`    | 组织静态字段子树，并控制收起与展开。 |
| 动态依赖字段 | `to`、`renderer`                                   | 根据当前表单值动态返回一组字段。     |
| 动态数组字段 | `key`、`name`、`item`                              | 根据对象数组值按行展开字段模板。     |

普通字段还支持 Core 的 `preserve`；Schema 被移除或字段改名时默认保留字段值和状态，设为 `preserve: false` 才会清理旧路径。Schema 通用状态、分组折叠参数和动态依赖示例见 [`@schemx/core`](../core)。Vue 组件 Props、Slots 和组合式 API 见 [`@schemx/vue`](../vue)。

## 覆盖或新增 Renderer

根入口导出的 `rendererRegistry` 与 `@schemx/vue` 导出的全局 Registry 是同一实例，Vant 默认项注册在其中。可通过同一实例覆盖某个类型，或注册新类型：

```ts
import { rendererRegistry } from "@schemx/vant"

import CustomInput from "./CustomInput.vue"
import AddressPicker from "./AddressPicker.vue"

rendererRegistry.register("input", CustomInput)
rendererRegistry.register("addressPicker", AddressPicker)
```

需要避免全局共享时，创建独立 `RendererRegistry` 并将其传给 `<Schemx :renderer-registry="registry" />` 或 `useForm({ rendererRegistry: registry })`。

## Renderer API

每个 Renderer 都是可直接注册到 `rendererRegistry` 的 Vue 组件，并从根入口导出对应的组件和 Props 类型。Schema 中使用 `componentType` 选择 Renderer，具体参数放在 `componentProps` 中；下列小节只列出各 Renderer 的值类型、Schemx 注入项和 Vant 专属配置。

单独挂载 Renderer 时，表中 `onChange`、`onBlur` 等回调由 Renderer 自身处理；通过 `<Schemx>` 使用时，`@schemx/vue` 的 `Field` 会注入统一的字段回调，并在其中调用 `componentProps` 和 Schema 顶层回调。需要异步替换值或等待 Renderer 内部 loading 的场景，应按对应 Renderer 的独立组件契约接入。

### `input` / `InputRenderer`

- **值与选项：** `InputValue = FieldProps["modelValue"]`；无 Option。
- **Props：** `InputRendererProps extends Omit<SchemxBaseComponentProps, "onChange" | "onBlur" | "value" | "onUpdate:value">`，不直接继承全部 `FieldProps`。
- **Dictionary：** 不支持。
- **行为：** `formatter` 按 `formatTrigger` 处理输入；无确认步骤；`clearable` 使用 Vant Field 清空；`readonly` 使用 `Wrapper` 的只读插槽展示，`disabled` 保留输入但阻止编辑。

| 包内显式字段                                      | 类型 / 说明                        |
| ------------------------------------------------- | ---------------------------------- |
| `value`                                           | `InputValue`，当前值。             |
| `onChange`                                        | `(value: string) => void`。        |
| `onBlur` / `onFocus`                              | `(event: FocusEvent) => void`。    |
| `type`                                            | `FieldProps["type"]`。             |
| `readonly` / `disabled`                           | 只读 / 禁用状态。                  |
| `placeholder` / `readonlyPlaceholder`             | 输入占位 / 空只读占位。            |
| `autofocus`                                       | 是否自动聚焦。                     |
| `maxlength`                                       | 最大输入长度。                     |
| `min` / `max`                                     | 数字输入边界。                     |
| `rows`                                            | textarea 行数。                    |
| `autosize`                                        | `boolean \| TextAreaAutosize`。    |
| `formatter` / `formatTrigger`                     | Vant Field 格式化函数 / 触发时机。 |
| `clearable` / `clearIcon` / `clearTrigger`        | 清空按钮配置。                     |
| `leftIcon` / `rightIcon`                          | 左右图标。                         |
| `showWordLimit`                                   | 是否显示字数统计。                 |
| `className`                                       | Renderer 根元素类名。              |
| `autocomplete` / `autocapitalize` / `autocorrect` | 原生输入提示属性。                 |
| `enterkeyhint` / `spellcheck` / `inputmode`       | 原生键盘与拼写属性。               |
| `align`                                           | `"left" \| "right" \| "center"`。  |

```ts
const field = {
  name: "nickname",
  label: "昵称",
  componentType: "input",
  componentProps: { placeholder: "请输入昵称", clearable: true },
} as const
```

### `text` / `TextRenderer`

- **值与选项：** `TextValue = Extract<InputValue, string>`；无 Option。
- **Props：** `TextRendererProps extends Omit<SchemxInputProps, "value" | "onChange">`，再重写下表字段。
- **Dictionary：** 不支持。
- **行为：** 支持 Field formatter；`type: "password"` 时提供显隐按钮；无确认步骤；`clearable` 可清空；`readonly` 使用 `Wrapper` 的只读插槽，`disabled` 禁止输入。

| 包内重写字段                                    | 类型 / 说明                 |
| ----------------------------------------------- | --------------------------- |
| `value`                                         | `TextValue`。               |
| `onChange`                                      | `(value: string) => void`。 |
| `onBlur` / `onFocus`                            | Focus 回调。                |
| `className`                                     | 根元素类名。                |
| `placeholder` / `readonlyPlaceholder`           | 占位文本。                  |
| `readonly` / `disabled`                         | 只读 / 禁用。               |
| `align`                                         | 文本对齐。                  |
| `clearable` / `clearIcon` / `clearTrigger`      | 清空配置。                  |
| `leftIcon` / `rightIcon`                        | 图标。                      |
| `showWordLimit` / `maxlength`                   | 字数限制与统计。            |
| `min` / `max`                                   | 数字模式边界。              |
| `formatter` / `formatTrigger`                   | 格式化配置。                |
| `autocomplete` / `autocapitalize` / `autofocus` | 原生输入配置。              |

### `textarea` / `TextAreaRenderer`

- **值与选项：** `TextAreaValue = InputValue`；无 Option。
- **Props：** `TextAreaRendererProps extends Omit<SchemxInputProps, "value" | "type" | "onChange">`。
- **Dictionary：** 不支持。
- **行为：** 强制使用 textarea；`autoSize` 兼容旧拼写并优先于 `autosize`；无确认步骤；可通过继承的 `clearable` 清空；只读时使用 `Wrapper` 的只读插槽，禁用时隐藏字数统计。

| 包内重写 / 新增字段                             | 类型 / 说明                                    |
| ----------------------------------------------- | ---------------------------------------------- |
| `value`                                         | `TextAreaValue`。                              |
| `onChange`                                      | `(value: string) => void`。                    |
| `onBlur` / `onFocus`                            | Focus 回调。                                   |
| `className`                                     | 根元素类名。                                   |
| `autosize`                                      | `boolean \| TextAreaAutosize`。                |
| `autoSize`                                      | `autosize` 的兼容旧属性名，优先级更高。        |
| `rows`                                          | 显式行数；未传时取 `autosize.minRows` 或 `2`。 |
| `maxlength` / `showWordLimit`                   | 字数限制与统计。                               |
| `readonly` / `readonlyPlaceholder` / `disabled` | 状态与空只读占位。                             |
| `align`                                         | 文本对齐。                                     |

### `number` / `NumberRenderer`

- **值与选项：** `NumberValue = InputValue`，运行时保持字符串形式；无 Option。
- **Props：** `NumberRendererProps extends Omit<SchemxInputProps, "value" | "type" | "onChange">`。
- **Dictionary：** 不支持。
- **行为：** `number` 支持小数、`digit` 仅整数；无确认步骤；`clearable` 可清空为空字符串；`readonly` 使用 `Wrapper` 的只读插槽，`disabled` 禁止输入。

| 包内重写字段                                    | 类型 / 说明                 |
| ----------------------------------------------- | --------------------------- |
| `value`                                         | `NumberValue`。             |
| `onChange`                                      | `(value: string) => void`。 |
| `onBlur` / `onFocus`                            | Focus 回调。                |
| `className`                                     | 根元素类名。                |
| `type`                                          | `"number" \| "digit"`。     |
| `readonly` / `readonlyPlaceholder` / `disabled` | 状态与占位。                |
| `align`                                         | 默认右对齐。                |
| `clearable`                                     | 是否显示清空按钮。          |
| `min` / `max`                                   | 数值边界。                  |
| `maxlength`                                     | 最大输入长度。              |

### `switch` / `SwitchRenderer`

- **值与选项：** `SwitchValue = boolean | string | number`；无 Option。
- **Props：** 同时继承 Schemx 基础契约与 `Partial<Omit<SwitchProps, "modelValue" | "onUpdate:modelValue" | "onChange" | "activeValue" | "inactiveValue" | "loading" | "disabled">>`。
- **Dictionary：** 不支持。
- **行为：** `onChange` 可异步返回替代值，等待期间显示 loading；切换即确认；无独立清空；`readonly` 用 `Wrapper` 的只读插槽显示 active/inactive 文案，`disabled` 禁止切换。

| 包内重写 / 新增字段                             | 类型 / 说明                                         |
| ----------------------------------------------- | --------------------------------------------------- |
| `value`                                         | `SwitchValue`。                                     |
| `onChange`                                      | `(value) => void \| Promise<SwitchValue \| void>`。 |
| `className`                                     | 根元素类名。                                        |
| `activeText` / `inactiveText`                   | 只读展示文案。                                      |
| `activeValue` / `inactiveValue`                 | 开 / 关对应值，默认 `true` / `false`。              |
| `readonly` / `readonlyPlaceholder` / `disabled` | 状态与占位。                                        |

### `radio` / `RadioRenderer`

- **值与选项：** `RadioValue = RadioProps["name"]`；`RadioOption` 继承 `Partial<Omit<RadioProps, "modelValue" | "onUpdate:modelValue" | "name">>`，增加 `label`、`value` 与扩展字段。
- **Props：** 同时继承 Schemx 基础契约与 `Partial<Omit<RadioProps, "modelValue" | "onUpdate:modelValue" | "name">>`。
- **Dictionary：** 完整支持。
- **行为：** 选中即更新，无额外格式化和确认步骤；无内置清空按钮；`readonly` 用 `Wrapper` 的只读插槽映射选项标签，`disabled` 禁用组及选项。

| 包内重写 / 新增字段                             | 类型 / 说明                       |
| ----------------------------------------------- | --------------------------------- |
| `value`                                         | `RadioValue`。                    |
| `onChange`                                      | `(value: RadioValue) => void`。   |
| `options`                                       | `RadioOption[]`。                 |
| `fieldNames`                                    | `{ label?, value?, disabled? }`。 |
| `className`                                     | 根元素类名。                      |
| `readonly` / `readonlyPlaceholder` / `disabled` | 状态与占位。                      |

### `checkbox` / `CheckboxRenderer`

- **值与选项：** `CheckboxValue = CheckboxProps["name"][] | string`；`CheckboxOption` 继承排除 model/change/name 的 Vant Checkbox Props，并增加 `label`、`value` 与扩展字段。
- **Props：** 同时继承 Schemx 基础契约与 `Partial<Omit<CheckboxProps, "modelValue" | "onUpdate:modelValue" | "onChange" | "name">>`。
- **Dictionary：** 完整支持。
- **行为：** 字符串输入按逗号拆分为组选中值，变更回传数组；无确认步骤和内置清空按钮；`readonly` 用 `Wrapper` 的只读插槽以 `、` 拼接标签，`disabled` 禁用组及选项。

| 包内重写 / 新增字段                             | 类型 / 说明                        |
| ----------------------------------------------- | ---------------------------------- |
| `value`                                         | `CheckboxValue`。                  |
| `onChange`                                      | `(value: CheckboxValue) => void`。 |
| `options`                                       | `CheckboxOption[]`。               |
| `fieldNames`                                    | `{ label?, value?, disabled? }`。  |
| `className`                                     | 根元素类名。                       |
| `readonly` / `readonlyPlaceholder` / `disabled` | 状态与占位。                       |

### `date` / `DateRenderer`

- **值与选项：** `DateValue = string | string[] | Date`；无 Option。
- **Props：** 同时继承 Schemx 基础契约与 `Partial<Omit<DatePickerProps, "modelValue" | "onUpdate:modelValue">>`。
- **Dictionary：** 不支持。
- **行为：** 输入统一经 dayjs 和 `format` 转成字符串；确认时依次写值、调用 `onConfirm` / `onChange` 并关闭；取消不改值，Popup 关闭触发 `onBlur`；无内置清空；只读 / 禁用不挂载 Popup。

| 包内重写 / 新增字段                             | 类型 / 说明                                                   |
| ----------------------------------------------- | ------------------------------------------------------------- |
| `value`                                         | `DateValue`。                                                 |
| `onConfirm` / `onChange`                        | `(value: string) => void`。                                   |
| `onBlur`                                        | Popup 关闭回调。                                              |
| `onClose`                                       | 声明的关闭回调；Popup 关闭时在 `onBlur` 后调用。              |
| `format`                                        | `string \| (() => string)`；函数返回传给 dayjs 的格式字符串。 |
| `className` / `popupClassName`                  | 根元素 / Popup 类名。                                         |
| `popupProps`                                    | `Partial<Omit<PopupProps, "show">>`。                         |
| `contentAlign`                                  | Cell 内容对齐。                                               |
| `readonly` / `readonlyPlaceholder` / `disabled` | 状态与占位。                                                  |

```ts
import type { DateRendererProps, SchemxField } from "@schemx/vant"

const dateProps = {
  format: "YYYY-MM-DD",
  minDate: new Date(2020, 0, 1),
  maxDate: new Date(2030, 11, 31),
  popupProps: { closeOnClickOverlay: false },
} satisfies DateRendererProps

const dateField: SchemxField<{ birthday: string }>[] = [
  {
    name: "birthday",
    label: "生日",
    componentType: "date",
    componentProps: dateProps,
  },
]
```

### `calendar` / `CalendarRenderer`

- **值与选项：** `CalendarValue = string | string[] | Date | Date[]`；无 Option。
- **Props：** 同时继承 Schemx 基础契约与 `Partial<Omit<CalendarProps, "show" | "onUpdate:show">>`。
- **Dictionary：** 不支持。
- **行为：** 单选 / 范围 / 多选日期经 `format` 转为字符串或字符串数组供回调与展示，模型保留 Vant 返回的 `Date` / `Date[]`；确认后关闭，关闭触发 `onBlur`；无内置清空；`readonly` 使用 `Wrapper` 的只读插槽，`disabled` 阻止打开。

| 包内重写 / 新增字段            | 类型 / 说明                              |
| ------------------------------ | ---------------------------------------- |
| `value`                        | `CalendarValue`。                        |
| `onConfirm` / `onChange`       | `(value: string \| string[]) => void`。  |
| `onBlur`                       | Calendar 关闭回调。                      |
| `className` / `popupClassName` | 根元素 / Calendar 类名。                 |
| `readonly` / `disabled`        | 只读、禁用状态。                         |
| `readonlyPlaceholder`          | 空只读占位。                             |
| `type`                         | `CalendarProps["type"]`，默认 `single`。 |
| `title`                        | Calendar 标题。                          |
| `format`                       | 日期格式字符串，默认 `YYYY-MM-DD`。      |
| `separator`                    | 范围展示分隔符，默认 `" - "`。           |
| `contentAlign`                 | Cell 内容对齐。                          |

```ts
import type { CalendarRendererProps } from "@schemx/vant"

const calendarProps = {
  type: "range",
  format: "YYYY-MM-DD",
  separator: " 至 ",
  minDate: new Date(2024, 0, 1),
} satisfies CalendarRendererProps
```

### `picker` / `PickerRenderer`

- **值与选项：** `PickerValue = PickerProps["modelValue"][number] | PickerProps["modelValue"]`；选项使用 Vant `PickerOption`。
- **Props：** 同时继承 Schemx 基础契约与 `Partial<Omit<PickerProps, "modelValue" | "onUpdate:modelValue">>`。
- **Dictionary：** 完整支持。
- **行为：** `options` 非空时优先于 `columns`；确认时 `emitPath` 决定返回完整路径还是末级值，并携带 Vant detail；取消不改值，关闭触发 `onBlur`；无内置清空；只读 / 禁用不挂载 Popup。

| 包内重写 / 新增字段                             | 类型 / 说明                                           |
| ----------------------------------------------- | ----------------------------------------------------- |
| `value`                                         | `PickerValue`。                                       |
| `onConfirm` / `onChange`                        | `(value, detail: PickerConfirmEventParams) => void`。 |
| `onBlur`                                        | Popup 关闭回调。                                      |
| `className` / `popupClassName`                  | 根元素 / Popup 类名。                                 |
| `emitPath`                                      | 是否返回完整值路径，默认 `false`。                    |
| `showAllLevels`                                 | 是否展示完整标签路径，默认 `false`。                  |
| `separator`                                     | 标签路径分隔符，默认 `" - "`。                        |
| `options`                                       | `PickerOption[]`，供 Dictionary 与统一选项输入使用。  |
| `columns` / `columnsFieldNames`                 | Vant 原生列与字段名。                                 |
| `fieldNames`                                    | `PickerFieldNames`；`columnsFieldNames` 优先。        |
| `title`                                         | Picker 标题。                                         |
| `contentAlign`                                  | Cell 内容对齐。                                       |
| `popupProps`                                    | `Partial<Omit<PopupProps, "show">>`。                 |
| `readonly` / `readonlyPlaceholder` / `disabled` | 状态与占位。                                          |

```ts
import type { PickerRendererProps, SchemxField } from "@schemx/vant"

const areaPickerProps = {
  emitPath: true,
  showAllLevels: true,
  fieldNames: { text: "name", value: "code", children: "children" },
  options: [
    {
      name: "浙江",
      code: "33",
      children: [{ name: "杭州", code: "3301" }],
    },
  ],
} satisfies PickerRendererProps

const areaField: SchemxField<{ area: string[] }>[] = [
  {
    name: "area",
    label: "地区",
    componentType: "picker",
    componentProps: areaPickerProps,
  },
]
```

### `selectPicker` / `SelectPickerRenderer`

- **值与选项：** `SelectPickerValue` 是 Radio / Checkbox name 或其数组；`SelectPickerOption` 提供 `label`、`value`、`disabled` 与扩展字段。
- **Props：** 继承 `Omit<SchemxBaseComponentProps, "onChange" | "onBlur" | "value" | "onUpdate:value">`，不继承完整 Vant Popup / Radio / Checkbox Props。
- **Dictionary：** 完整支持。
- **行为：** 弹窗内先写 `pendingValue`，点击确认才更新模型并依次调用 `onChange` / `onConfirm`；关闭不提交并触发 `onBlur`；无内置清空；`readonly` 使用 `Wrapper` 的只读插槽，`disabled` 阻止打开。

| 包内显式字段                   | 类型 / 说明                                                  |
| ------------------------------ | ------------------------------------------------------------ |
| `value`                        | `SelectPickerValue`。                                        |
| `onChange` / `onConfirm`       | `(value, detail) => void`。                                  |
| `onBlur`                       | Popup 关闭回调。                                             |
| `className` / `popupClassName` | 根元素 / Popup 类名。                                        |
| `readonly` / `disabled`        | 只读、禁用。                                                 |
| `readonlyPlaceholder`          | 空只读占位。                                                 |
| `options` / `columns`          | `SelectPickerOption[]`；非空 `options` 优先。                |
| `fieldNames`                   | `SelectPickerFieldNames`。                                   |
| `type`                         | `"radio" \| "checkbox"`，默认 `checkbox`。                   |
| `title`                        | 弹窗标题。                                                   |
| `contentAlign`                 | Cell 内容对齐。                                              |
| `popupProps`                   | `Partial<Omit<PopupProps, "show">>`，运行时也会剔除 `show`。 |

```ts
import type { SelectPickerRendererProps, SchemxField } from "@schemx/vant"

const roleProps = {
  type: "checkbox",
  title: "选择角色",
  options: [
    { label: "管理员", value: "admin" },
    { label: "审阅者", value: "reviewer", disabled: true },
  ],
} satisfies SelectPickerRendererProps

const roleField: SchemxField<{ roles: string[] }>[] = [
  {
    name: "roles",
    label: "角色",
    componentType: "selectPicker",
    componentProps: roleProps,
  },
]
```

### `selector` / `SelectorRenderer`

- **值与选项：** `SelectValue = string | number | (string | number)[]`；`SelectorOption` 提供 `label`、`value`、`disabled` 与扩展字段。
- **Props：** 继承 `Omit<SchemxBaseComponentProps, "onChange" | "onBlur" | "value" | "onUpdate:value">`。
- **Dictionary：** 完整支持。
- **行为：** `SelectorRendererProps` 继承 `SelectorProps`，因此 `multiple` 在 Renderer 和内部 `Selector` 类型中都可用；默认单选，设为 `true` 后返回数组。点击即更新，无格式化、确认或内置清空；`readonly` 使用 `Wrapper` 的只读插槽，`disabled` 禁止选择。

| 包内显式字段                                    | 类型 / 说明                       |
| ----------------------------------------------- | --------------------------------- |
| `value`                                         | `SelectValue`。                   |
| `onChange`                                      | `(value: SelectValue) => void`。  |
| `options`                                       | `SelectorOption[]`。              |
| `multiple`                                      | `boolean`，默认 `false`。         |
| `fieldNames`                                    | `{ label?, value?, disabled? }`。 |
| `className`                                     | 根元素类名。                      |
| `readonly` / `readonlyPlaceholder` / `disabled` | 状态与占位。                      |

#### `SelectorProps`（内部 Selector 组件）

根入口同时公开 `SelectorProps`，它描述包内 `Selector.vue` 基础组件。`SelectorRendererProps` 在此基础上使用 Schemx 的 `value` / `onChange` 契约，并在运行时把值转换为内部组件的 `modelValue`；两者共享 `options`、`fieldNames`、`disabled` 和 `multiple` 的语义。

| 字段         | 类型                                                    | 默认值                                                     | 说明                                                  |
| ------------ | ------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------- |
| `modelValue` | `SelectValue`                                           | `[]`                                                       | 内部 Selector 当前选中值；Renderer 对外对应 `value`。 |
| `options`    | `SelectorOption[]`                                      | `[]`                                                       | 选项列表。                                            |
| `multiple`   | `boolean`                                               | `false`                                                    | 是否多选；`SelectorRendererProps` 也会继承该字段。    |
| `fieldNames` | `{ label?: string; value?: string; disabled?: string }` | `{ label: "label", value: "value", disabled: "disabled" }` | 选项字段映射。                                        |
| `disabled`   | `boolean`                                               | `false`                                                    | 禁用整个内部 Selector。                               |

### `sensitiveInput` / `SensitiveInputRenderer`

- **值与选项：** `SensitiveInputValue = string`；无 Option。
- **Props：** `SensitiveInputRendererProps extends Omit<SchemxInputProps, "type" | "value" | "onChange">`。
- **Dictionary：** 不支持。
- **行为：** 默认使用 Renderer 子目录内实现的 `defaultMaskFormatter` 脱敏；`maskFormatter` 只影响脱敏展示，`formatter` 用于完整值展示和输入格式化。无确认步骤，展开输入继承清空能力；`disabled` 不可展开，`readonly` 仅在 `revealWhenReadonly` 为真时可查看完整值。`defaultMaskFormatter` 不从 `@schemx/vant` 根入口导出。

| 包内重写 / 新增字段       | 类型 / 说明                                                                   |
| ------------------------- | ----------------------------------------------------------------------------- |
| `value`                   | `SensitiveInputValue`，真实值。                                               |
| `onChange`                | 回传未脱敏的输入字符串；若配置 `formatter`，回调收到格式化后的值。            |
| `formatter`               | 完整值展示格式化。                                                            |
| `maskFormatter`           | 脱敏格式化；未传时使用子目录内的 `defaultMaskFormatter`。                     |
| `defaultRevealed`         | 非受控初始展开状态。                                                          |
| `revealed`                | 类型中声明的受控状态；当前实现仍以内部状态为准，不会按该值同步。              |
| `onRevealChange`          | 类型中声明的回调；当前实现通过 `reveal-change` 事件通知，未调用该 Prop 回调。 |
| `revealable`              | 是否允许展开。                                                                |
| `revealText` / `hideText` | 按钮文案。                                                                    |
| `revealIcon` / `hideIcon` | 按钮图标。                                                                    |
| `focusOnReveal`           | 展开后是否聚焦。                                                              |
| `hideOnBlur`              | 失焦后是否重新脱敏。                                                          |
| `revealWhenReadonly`      | 只读时是否允许展开。                                                          |

组件通过 `reveal-change` 事件通知展开状态变化；该事件参数为 `(revealed: boolean)`。当前展开状态由内部管理，初始状态可通过 `defaultRevealed` 设置；若需要受控展开，当前版本尚未实现 `revealed` / `onRevealChange` 的受控语义。

### `rate` / `RateRenderer`

- **值与选项：** `RateValue = RateProps["modelValue"]`；无 Option。
- **Props：** 同时继承 Schemx 基础契约与 `Partial<Omit<RateProps, "modelValue" | "onUpdate:modelValue" | "onChange">>`。
- **Dictionary：** 不支持。
- **行为：** 值直接传给 Vant Rate，无额外格式化或确认；无内置清空；只读且值为 `0` / 空时显示占位，否则显示只读 Rate；禁用阻止评分。

| 包内重写 / 新增字段                             | 类型 / 说明                    |
| ----------------------------------------------- | ------------------------------ |
| `value`                                         | `RateValue`。                  |
| `onChange`                                      | `(value: RateValue) => void`。 |
| `count`                                         | 星星总数，默认 `5`。           |
| `allowHalf`                                     | 是否允许半星。                 |
| `className`                                     | 根元素类名。                   |
| `readonly` / `readonlyPlaceholder` / `disabled` | 状态与占位。                   |

### `slider` / `SliderRenderer`

- **值与选项：** `SliderValue = SliderProps["modelValue"]`，支持单值或范围；无 Option。
- **Props：** 同时继承 Schemx 基础契约与 `Partial<Omit<SliderProps, "modelValue" | "onUpdate:modelValue" | "onChange">>`。
- **Dictionary：** 不支持。
- **行为：** 范围值只读展示用 `" - "` 连接；拖动即更新，无确认或内置清空；`readonly` 使用 `Wrapper` 的只读插槽，`disabled` 由 Vant Slider 阻止交互。

| 包内重写 / 新增字段                             | 类型 / 说明                      |
| ----------------------------------------------- | -------------------------------- |
| `value`                                         | `SliderValue`。                  |
| `onChange`                                      | `(value: SliderValue) => void`。 |
| `min` / `max` / `step`                          | 最小值、最大值、步长。           |
| `range`                                         | 是否范围选择。                   |
| `className`                                     | 根元素类名。                     |
| `readonly` / `readonlyPlaceholder` / `disabled` | 状态与占位。                     |

### `stepper` / `StepperRenderer`

- **值与选项：** `StepperValue = StepperProps["modelValue"]`；无 Option。
- **Props：** 同时继承 Schemx 基础契约与 `Partial<Omit<StepperProps, "modelValue" | "onUpdate:modelValue" | "onChange">>`。
- **Dictionary：** 不支持。
- **行为：** 直接遵循 Vant 的数值、整数与小数位规则；点击即更新，无确认；`allowEmpty` 可清空；`readonly` 使用 `Wrapper` 的只读插槽，`disabled` 禁止调整。

| 包内重写 / 新增字段                             | 类型 / 说明                       |
| ----------------------------------------------- | --------------------------------- |
| `value`                                         | `StepperValue`。                  |
| `onChange`                                      | `(value: StepperValue) => void`。 |
| `min` / `max` / `step`                          | 边界与步长。                      |
| `integer` / `decimalLength`                     | 整数限制 / 小数位数。             |
| `allowEmpty`                                    | 是否允许空值。                    |
| `className`                                     | 根元素类名。                      |
| `readonly` / `readonlyPlaceholder` / `disabled` | 状态与占位。                      |

### `upload` / `UploadRenderer`

- **值与选项：** `UploadValue = UploadFile[]`；`UploadFile` 是兼容 Vant 文件项的本包结构。
- **Props：** 同时继承 Schemx 基础契约与 `Partial<Omit<UploaderProps, "modelValue" | "onUpdate:modelValue" | "imageFit">>`，并补充文件列表与预览配置。
- **Dictionary：** 不支持。
- **行为：** 默认 `afterRead` 调用 `uploader`，维护 uploading / done / failed 状态；上传成功或删除后回调 `onChange`。`listType: "card"` 使用图片卡片布局，`listType: "list"` 使用横向附件列表；图片可通过 `previewFullImage` 打开 `ImagePreview`。`beforeDelete` 会在实际删除前执行，支持同步或异步拦截。`readonly` 隐藏上传和删除，且无文件时展示 `readonlyPlaceholder`；`disabled` 禁用 Uploader；`disableUpload` 仅隐藏新增入口，保留已有文件删除能力。`multiple` 默认 `true`，也可显式设为 `false`。

| 包内重写 / 新增字段     | 类型 / 说明                                                      |
| ----------------------- | ---------------------------------------------------------------- |
| `value`                 | `UploadValue`。                                                  |
| `onChange`              | `(files: UploadFile[]) => void`。                                |
| `accept`                | 接受的文件类型，默认 `"*"`。                                     |
| `className`             | 根元素类名。                                                     |
| `showUpload`            | 是否显示上传入口。                                               |
| `multiple`              | 是否允许多文件选择，默认 `true`。                                |
| `listType`              | `"card" \| "list"`；图片卡片或横向附件列表，默认 `"card"`。      |
| `imageFit`              | 图片缩略图填充方式，默认 `"cover"`。                             |
| `previewFullImage`      | 是否允许点击图片打开全屏预览，默认 `true`。                      |
| `previewOptions`        | 透传给 Vant `ImagePreview` 的配置；图片与起始位置由组件控制。    |
| `disableUpload`         | 隐藏上传入口，不影响已有文件的删除。                             |
| `deletable`             | 是否可删除。                                                     |
| `readonly` / `disabled` | 只读、禁用状态。                                                 |
| `readonlyPlaceholder`   | 只读且无文件时由 `Wrapper` 的只读插槽展示的占位文本。            |
| `uploader`              | `(file: File) => Promise<any>`。                                 |
| `propsHttp`             | `{ res?, url?, name? }`；覆盖上传响应中的数据、URL、文件名字段。 |

`propsHttp` 默认值为 `{ res: "data", url: "link", name: "originalName" }`；自定义 `uploader` 的返回值按这三个字段读取，也可通过 `propsHttp` 改为接口实际字段：

实际上传必须提供返回结构与 `propsHttp` 匹配的 `uploader`；内置默认函数只返回空对象，不能完成文件上传。

```ts
type UploadResponse = {
  data: {
    link: string
    originalName: string
  }
}
```

```ts
import type { SchemxField, UploadRendererProps } from "@schemx/vant"

const uploadProps = {
  accept: "image/*",
  maxCount: 3,
  uploader: async (file) => {
    const body = new FormData()
    body.append("file", file)
    const response = await fetch("/api/upload", { method: "POST", body })

    // 接口必须返回 { data: { link, originalName } }
    return (await response.json()) as {
      data: { link: string; originalName: string }
    }
  },
} satisfies UploadRendererProps

const uploadField: SchemxField<{ photos: { url?: string }[] }>[] = [
  {
    name: "photos",
    label: "照片",
    componentType: "upload",
    componentProps: uploadProps,
  },
]
```

### `cascader` / `CascaderRenderer`

- **值与选项：** `CascaderValue = Array<NonNullable<CascaderProps["modelValue"]>>`，始终以数组承载路径或末级值；选项使用 Vant Cascader options。
- **Props：** 同时继承 Schemx 基础契约与 `Partial<Omit<CascaderProps, "modelValue" | "onUpdate:modelValue">>`。
- **Dictionary：** HOC 可以加载并注入选项；Schema `componentProps` 类型也支持 `dict`，远程选项会传给 Vant Cascader。
- **行为：** `options` 可把已有值映射为展示标签路径，也会作为级联弹窗数据源。事件处理代码会在收到 finish 时按 `emitPath` 生成路径、调用 `onConfirm` / `onChange`，关闭触发 `onBlur`；无内置清空；只读 / 禁用不挂载 Popup。

| 包内重写 / 新增字段                             | 类型 / 说明                                                  |
| ----------------------------------------------- | ------------------------------------------------------------ |
| `value`                                         | `CascaderValue`。                                            |
| `onConfirm` / `onChange`                        | `(value: CascaderValue) => void`。                           |
| `onBlur`                                        | Cascader 关闭回调。                                          |
| `className` / `popupClassName`                  | 根元素 / Popup 类名。                                        |
| `showAllLevels`                                 | 是否展示全部标签层级，默认 `true`。                          |
| `emitPath`                                      | 是否返回完整路径，默认 `true`。                              |
| `fieldNames`                                    | `CascaderFieldNames`。                                       |
| `separator`                                     | 标签路径分隔符，默认 `" - "`。                               |
| `options`                                       | `CascaderProps["options"]`；同时用于展示标签映射和级联弹窗。 |
| `title`                                         | Cascader 标题。                                              |
| `contentAlign`                                  | Cell 内容对齐。                                              |
| `popupProps`                                    | `Partial<Omit<PopupProps, "show">>`，运行时剔除 `show`。     |
| `readonly` / `readonlyPlaceholder` / `disabled` | 状态与占位。                                                 |

> 下例使用 `readonly` 展示标签路径映射；将 `readonly` 改为 `false` 即可打开带有 `options` 的级联弹窗。

```ts
import type { CascaderRendererProps, SchemxField } from "@schemx/vant"

const regionProps = {
  readonly: true,
  emitPath: true,
  showAllLevels: true,
  fieldNames: { text: "name", value: "code", children: "children" },
  options: [
    {
      name: "浙江",
      code: "33",
      children: [{ name: "杭州", code: "3301" }],
    },
  ],
  popupProps: { closeOnClickOverlay: false },
} satisfies CascaderRendererProps

const initialValues: { region: string[] } = {
  region: ["33", "3301"],
}

const regionField: SchemxField<typeof initialValues>[] = [
  {
    name: "region",
    label: "地区",
    componentType: "cascader",
    componentProps: regionProps,
  },
]
```

将 `initialValues` 传给表单后，Renderer 可显示“浙江 - 杭州”；示例使用 `readonly: true` 先展示标签路径，编辑态同样会使用这些 `options` 打开级联弹窗。

## 工具函数

| 导出                      | 参数                                                                             | 返回值               | 行为与适用场景                                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `getFieldProps`           | `attrs: T`、`key: keyof T`、可选 `defaultValue`                                  | `T[typeof key]`      | 读取 attrs 中的字段；仅在结果为 `null` / `undefined` 时回退默认值，`false`、`0` 和空字符串会保留。                                       |
| `isEmptyDisplayValue`     | `value: unknown`                                                                 | `boolean`            | 仅把 `undefined`、`null`、空字符串和空数组判为空；`0`、`false`、空对象及非空数组不为空。                                                 |
| `getReadonlyDisplayValue` | `value: T`、可选 `readonlyPlaceholder = "-"`                                     | `T \| string`        | 按 `isEmptyDisplayValue()` 判断；空值返回只读占位，其余值原样返回。                                                                      |
| `resolveRendererMode`     | `{ disabled?: boolean; readonly?: boolean }`                                     | `RendererMode`       | 解析展示模式；`disabled` 优先于 `readonly`，否则为 `"editable"`。                                                                        |
| `isRendererInteractive`   | `mode: RendererMode`                                                             | `boolean`            | 仅 `"editable"` 返回 `true`，用于统一守卫点击、键盘或弹窗交互。                                                                          |
| `findTreeItem`            | `tree: any[]`、`targetValue: any`、可选 `{ labelKey?, valueKey?, childrenKey? }` | `FindTreeItemResult` | 按数组顺序深度优先查找，使用严格相等比较 value；默认字段为 `label` / `value` / `children`，返回原节点及从根到节点的 label / value 路径。 |
| `getFileName`             | `url: string \| undefined \| null`                                               | `string`             | 去掉 query 和 hash 后取最后一个 `/` 后的片段；空输入、末段为空或解析异常时返回当前毫秒时间戳字符串。                                     |

`findTreeItem()` 在 `tree` 非数组、目标为 `null` / `undefined` 或没有匹配项时返回 `{ node: null, labels: [], values: [] }`；自定义字段配置可用于 Cascader、Picker 等不同选项结构。公开工具类型如下：

| 类型                 | 定义与用途                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| `RendererMode`       | `"editable" \| "disabled" \| "readonly"`，供模式解析与交互守卫共用。                                 |
| `FindTreeItemResult` | `{ node: Record<string, any> \| null; labels: string[]; values: any[] }`，描述树节点和两条祖先路径。 |

`cutString`、`formatNumber`、`getStringLength` 与脱敏 Renderer 子目录实现的 `defaultMaskFormatter` 当前仅属于包内实现，不从 `@schemx/vant` 根入口导出；本文不提供这些值的根入口导入示例。

## 默认注册行为

导入 `@schemx/vant` 根入口时，Vant 默认 Renderer 会注册到 `@schemx/vue` 共用的全局 `rendererRegistry`，并由入口写入模块级全局配置：`input`、`text`、`textarea`、`number`、`switch`、`radio`、`checkbox`、`date`、`calendar`、`picker`、`selectPicker`、`selector`、`sensitiveInput`、`rate`、`slider`、`stepper`、`upload`、`cascader`。Vant 与 Vue 导出的 `presetRuleRegistry` 也指向同一实例。

Field 使用 `col` 配置列宽，Form、Group 和 Dynamic 使用 `row` 配置行；Vant 的 Row/Col 已作为入口的全局默认值，也可通过表单 Props 或 `ConfigProvider` 覆盖。

`registerAll()` 会直接覆盖 Registry 中已有的同名项，因此自定义 Renderer 应在导入 `@schemx/vant` 后注册：

```ts
import Schemx, { rendererRegistry } from "@schemx/vant"
import CustomInputRenderer from "./CustomInputRenderer.vue"

rendererRegistry.register("input", CustomInputRenderer)
```

`register()` 默认也允许覆盖；需要保护已有项时可传 `{ override: false }`。Form 与 `useForm` 默认读取入口写入的全局配置；需要隔离时再显式传入 `rendererRegistry`、`presetRuleRegistry`、`colComponent` 和 `rowComponent`。若只导入 `@schemx/vue`，不会触发 Vant 的默认注册；深层导入源码既不保证副作用，也不属于发布出口。

`DEFAULT_RENDERER_TYPES` 是只读字面量元组，可用于枚举内置 Renderer。字段是否可编辑仍由 `readonly`、`disabled` 和对应 Renderer 的交互规则决定。

## 类型参考

根入口提供 Renderer 相关的 Props、Value、Option 和 FieldNames 类型。字段与限制已在对应的 [Renderer API](#renderer-api) 小节说明；这里按导出符号逐项索引，避免把同一契约重复成另一份可能漂移的字段表。

| Renderer       | 类型导出                      | 用途                                         |
| -------------- | ----------------------------- | -------------------------------------------- |
| Input          | `InputRendererProps`          | Input Renderer 的 Props。                    |
| Input          | `InputValue`                  | Input Renderer 的值类型。                    |
| Text           | `TextRendererProps`           | Text Renderer 的 Props。                     |
| Text           | `TextValue`                   | Text Renderer 的字符串值。                   |
| TextArea       | `TextAreaRendererProps`       | TextArea Renderer 的 Props。                 |
| TextArea       | `TextAreaAutosize`            | TextArea 自动高度配置。                      |
| TextArea       | `TextAreaValue`               | TextArea Renderer 的字符串值。               |
| Checkbox       | `CheckboxRendererProps`       | Checkbox Renderer 的 Props。                 |
| Checkbox       | `CheckboxOption`              | Checkbox 单个选项结构。                      |
| Checkbox       | `CheckboxValue`               | Checkbox Renderer 的数组或逗号分隔字符串值。 |
| Date           | `DateRendererProps`           | Date Renderer 的 Props。                     |
| Date           | `DateValue`                   | Date Renderer 的值类型。                     |
| Calendar       | `CalendarRendererProps`       | Calendar Renderer 的 Props。                 |
| Calendar       | `CalendarValue`               | Calendar 单日 / 范围 / 多选值。              |
| Number         | `NumberRendererProps`         | Number Renderer 的 Props。                   |
| Number         | `NumberValue`                 | Number Renderer 的输入值；更新时回传字符串。 |
| Picker         | `PickerRendererProps`         | Picker Renderer 的 Props。                   |
| Picker         | `PickerFieldNames`            | Picker 选项字段映射。                        |
| Picker         | `PickerValue`                 | Picker Renderer 的单值或路径数组。           |
| Radio          | `RadioRendererProps`          | Radio Renderer 的 Props。                    |
| Radio          | `RadioOption`                 | Radio 单个选项结构。                         |
| Radio          | `RadioValue`                  | Radio Renderer 的值类型。                    |
| Rate           | `RateRendererProps`           | Rate Renderer 的 Props。                     |
| Rate           | `RateValue`                   | Rate Renderer 的评分值。                     |
| Slider         | `SliderRendererProps`         | Slider Renderer 的 Props。                   |
| Slider         | `SliderValue`                 | Slider 单值或范围值。                        |
| Stepper        | `StepperRendererProps`        | Stepper Renderer 的 Props。                  |
| Stepper        | `StepperValue`                | Stepper Renderer 的值类型。                  |
| Switch         | `SwitchRendererProps`         | Switch Renderer 的 Props。                   |
| Switch         | `SwitchValue`                 | Switch Renderer 的值类型。                   |
| Upload         | `UploadRendererProps`         | Upload Renderer 的 Props。                   |
| Upload         | `UploadFile`                  | 单个上传文件项。                             |
| Upload         | `UploadValue`                 | 上传文件项数组。                             |
| Upload         | `UploadListType`              | 上传文件列表展示方式。                       |
| Cascader       | `CascaderRendererProps`       | Cascader Renderer 的 Props。                 |
| Cascader       | `CascaderFieldNames`          | Cascader 选项字段映射。                      |
| Cascader       | `CascaderValue`               | Cascader 路径或末级值数组。                  |
| Selector       | `SelectorRendererProps`       | Selector Renderer 的 Props。                 |
| Selector       | `SelectorOption`              | Selector 单个选项结构。                      |
| Selector       | `SelectorProps`               | 包内 Selector 基础组件 Props。               |
| Selector       | `SelectValue`                 | Selector 单选或多选值。                      |
| SelectPicker   | `SelectPickerFieldNames`      | SelectPicker 选项字段映射。                  |
| SelectPicker   | `SelectPickerOption`          | SelectPicker 单个选项结构。                  |
| SelectPicker   | `SelectPickerRendererProps`   | SelectPicker Renderer 的 Props。             |
| SelectPicker   | `SelectPickerValue`           | SelectPicker 单选或多选值。                  |
| SensitiveInput | `SensitiveInputRendererProps` | SensitiveInput Renderer 的 Props。           |
| SensitiveInput | `SensitiveInputValue`         | SensitiveInput 的真实字符串值。              |

`DEFAULT_RENDERER_TYPES` 是运行时值，不是类型；`defaultMaskFormatter` 当前不属于根入口公开 API。

## Vue 与 Core API

Vant 根入口重新导出 Vue 与 Core 的公开 API。默认导出、命名导出 `SchemxForm` 和传递导出的 `schemxForm` 指向同一个 Vue 表单组件。

字段联动同样使用 Core 的 `dependencies`：

```ts
import type { SchemxField } from "@schemx/vant"

type AccountValues = {
  accountType: "personal" | "company"
  companyName: string
}

const schemas: SchemxField<AccountValues>[] = [
  {
    name: "accountType",
    label: "账户类型",
    componentType: "radio",
    componentProps: {
      options: [
        { label: "个人", value: "personal" },
        { label: "企业", value: "company" },
      ],
    },
  },
  {
    name: "companyName",
    label: "企业名称",
    componentType: "input",
    dependencies: {
      triggerFields: ["accountType"],
      visible: (values) => values.accountType === "company",
      required: (values) => values.accountType === "company",
    },
  },
]
```

通过组件 `ref` 可访问表单实例，包括值读写、校验、提交、重置、Schema 更新和 `scrollToField()`。通用 API 使用上游文档维护：

- [Vue 组件、Slots 和组合式 API](../vue/README.md)
- [Core Schema、校验和表单实例 API](../core/README.md)
- [可运行的 Vant 示例](../../examples/vant/README.md)

本包导出各 Renderer、对应的 Props / Value / Option 类型、`DEFAULT_RENDERER_TYPES` 和 [工具函数](#工具函数)。`@schemx/core/adapter` 的专用 API 仍需从该子路径导入。
