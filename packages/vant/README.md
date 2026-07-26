# @schemx/vant

`@schemx/vant` 是基于 Vue 3、Vant 4 与 Schemx 的移动端 Schema 表单渲染包。导入根入口时会注册 18 个默认 Renderer，并重新导出 `@schemx/vue` 的公开 API。

## 安装与样式

```bash
pnpm add @schemx/vant @schemx/vue @schemx/core vant vue
```

`@schemx/core`、`@schemx/vue`、`vant` 和 `vue` 都是 peer dependencies，业务项目需要显式安装。直接使用 `@schemx/vant` 不需要额外配置 Schemx Vite 插件。

```ts
import Schemx from "@schemx/vant"
import "vant/lib/index.css"
```

样式有两个独立来源：

- `@schemx/vant` 的 ESM 根入口会自动导入 `@schemx/vant/style.css`，并经 `@schemx/vue` 根入口自动导入其基础样式。常规 Vite / Vue ESM 项目不需要再手动导入这两份 Schemx CSS。
- `vant/lib/index.css` 是 Vant 自身的组件样式，`@schemx/vant` 不会替业务项目加载。若项目已使用 Vant 官方插件或其他按需样式方案，则按该方案处理，不要重复导入。

若使用 CommonJS 入口，或构建工具没有保留入口中的 CSS import，请显式导入：

```ts
import "@schemx/vue/style.css"
import "@schemx/vant/style.css"
import "vant/lib/index.css"
```

## 快速开始

```vue
<script setup lang="ts">
  import { ref } from "vue"
  import "vant/lib/index.css"

  import Schemx from "@schemx/vant"
  import type { SchemxField, SchemxInstance } from "@schemx/vant"

  type ProfileValues = {
    name: string
    city: string
    notification: boolean
  }

  const formRef = ref<SchemxInstance<ProfileValues>>()
  const formData = ref<ProfileValues>({
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

  function handleFinish(values: Readonly<ProfileValues>) {
    console.log(values)
  }
</script>

<template>
  <Schemx
    ref="formRef"
    v-model="formData"
    :schemas="schemas"
    :initial-values="formData"
    @finish="handleFinish"
  />

  <button type="button" @click="formRef?.submit()">提交</button>
</template>
```

`componentProps` 由 `componentType` 自动关联到对应 Renderer Props；Renderer 的值仍由字段 `name` 对应的表单值类型决定。

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

## Renderer 总览

下表顺序与根入口导出的 `DEFAULT_RENDERER_TYPES` 完全一致。Dictionary 的“完整支持”表示运行时存在 `WithRemoteOptions` 包装，且 `packages/vant/src/types/schemx.ts` 同时为 Schema `componentProps` 注入 `SchemxWithDictionary`。

| `componentType`  | 导出组件                 | Value 类型            | Option 类型                           | Dictionary                                                     | 主要 Vant 组件                                  |
| ---------------- | ------------------------ | --------------------- | ------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------- |
| `input`          | `InputRenderer`          | `InputValue`          | —                                     | 不支持                                                         | `Field`、`Cell`                                 |
| `text`           | `TextRenderer`           | `TextValue`           | —                                     | 不支持                                                         | `Field`、`Cell`                                 |
| `textarea`       | `TextAreaRenderer`       | `TextAreaValue`       | —                                     | 不支持                                                         | `Field`、`Cell`                                 |
| `number`         | `NumberRenderer`         | `NumberValue`         | —                                     | 不支持                                                         | `Field`、`Cell`                                 |
| `switch`         | `SwitchRenderer`         | `SwitchValue`         | —                                     | 不支持                                                         | `Switch`、`Cell`                                |
| `radio`          | `RadioRenderer`          | `RadioValue`          | `RadioOption`                         | 完整支持                                                       | `RadioGroup`、`Radio`、`Cell`                   |
| `checkbox`       | `CheckboxRenderer`       | `CheckboxValue`       | `CheckboxOption`                      | 完整支持                                                       | `CheckboxGroup`、`Checkbox`、`Cell`             |
| `date`           | `DateRenderer`           | `DateValue`           | —                                     | 不支持                                                         | `DatePicker`、`Popup`、`Cell`                   |
| `calendar`       | `CalendarRenderer`       | `CalendarValue`       | —                                     | 不支持                                                         | `Calendar`、`Cell`                              |
| `picker`         | `PickerRenderer`         | `PickerValue`         | Vant `PickerOption`（未从本包导出）   | 完整支持                                                       | `Picker`、`Popup`、`Cell`                       |
| `selectPicker`   | `SelectPickerRenderer`   | `SelectPickerValue`   | `SelectPickerOption`                  | 完整支持                                                       | `Popup`、`Checkbox` / `Radio`、`Button`、`Cell` |
| `selector`       | `SelectorRenderer`       | `SelectValue`         | `SelectorOption`                      | 完整支持                                                       | `Cell` + 包内 `Selector`                        |
| `sensitiveInput` | `SensitiveInputRenderer` | `SensitiveInputValue` | —                                     | 不支持                                                         | `Field`、`Cell`、`Icon`                         |
| `rate`           | `RateRenderer`           | `RateValue`           | —                                     | 不支持                                                         | `Rate`、`Cell`                                  |
| `slider`         | `SliderRenderer`         | `SliderValue`         | —                                     | 不支持                                                         | `Slider`、`Cell`                                |
| `stepper`        | `StepperRenderer`        | `StepperValue`        | —                                     | 不支持                                                         | `Stepper`、`Cell`                               |
| `upload`         | `UploadRenderer`         | `UploadValue`         | `UploadFile`（文件项）                | 不支持                                                         | `Uploader`                                      |
| `cascader`       | `CascaderRenderer`       | `CascaderValue`       | Vant `CascaderOption`（未从本包导出） | 完整支持                                                       | `Cascader`、`Popup`、`Cell`                     |

全部 Renderer 都接受 Schemx 字段上下文提供的基础契约。下文只列继承来源、排除或重写字段，以及本包显式增加的字段；Vant 的完整通用 Props 请查阅 Vant 文档。

## Dictionary

### 支持范围与优先级

`radio`、`checkbox`、`picker`、`selectPicker`、`selector`、`cascader` 在类型与运行时都支持 `dict`。`WithRemoteOptions` 在存在 `dict` 时调用 `useDictionary`，把结果注入为 `options`，并注入 `loading`；此时远程结果替代静态 `options`。没有 `dict` 时直接使用传入的静态 `options`。

`cascader` 的根导出通过 `WithRemoteOptions` 包装，静态 `options` 和 Dictionary 产生的远程选项都会传给 Vant `<Cascader>`，也会用于 Cell 标签路径映射。其 Schema 类型同样注入了 `SchemxWithDictionary`，因此可以像其他支持 Dictionary 的选择 Renderer 一样配置 `dict`。

### `SchemxDictionary` 字段

| 字段                | 类型                                     | 默认值   | 说明                                                                                                    |
| ------------------- | ---------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `api`               | `(values, form) => R \| Promise<R>`      | 必填     | 获取原始数据；接收当前表单值与实例。                                                                    |
| `formatter`         | `(res, form) => any[] \| Promise<any[]>` | —        | 把 API 响应转换为 Renderer 所需的选项数组。                                                             |
| `dependsOn`         | `NamePath[]`                             | —        | 依赖字段变化后重新加载。                                                                                |
| `shouldFetch`       | `(values) => boolean`                    | 始终执行 | 返回 `false` 时跳过请求并清空选项。                                                                     |
| `immediate`         | `boolean`                                | `true`   | 是否在挂载后立即加载。                                                                                  |
| `resetOnDepsChange` | `boolean`                                | `false`  | 依赖变化时清空当前字段；Vant 内建 Dictionary Renderer 会自动从 `FormItem` 的字段 Context 取得目标路径。 |
| `retryCount`        | `number`                                 | `0`      | 失败重试次数。                                                                                          |
| `retryInterval`     | `number`                                 | `1000`   | 重试间隔，单位为毫秒。                                                                                  |
| `onSuccess`         | `(data, form) => void`                   | —        | 格式化并写入选项后触发。                                                                                |
| `onError`           | `(error, form) => void`                  | —        | 最终失败后触发。                                                                                        |
| `onDepsChange`      | `(values, form) => void`                 | —        | 依赖变化后、`shouldFetch` 判断前触发。                                                                  |

请求计数只在通过 `shouldFetch` 检查、真正开始请求时递增，并且只在 API 成功返回与异步 `formatter` 完成后检查是否过期。因此，它能阻止旧的成功响应或旧的 formatter 结果覆盖更新请求，但不是完整的竞态隔离：`shouldFetch` 返回 `false` 时不会递增计数，先前在途的成功结果仍可能随后写回；错误分支也不检查请求计数，旧请求的错误仍可能覆盖较新的状态、清空选项并触发 `onError`。错误本身会被规范化为 `Error`。

`resetOnDepsChange` 仍以 `useDictionary(options, fieldName)` 的第二参数作为底层重置目标。Vant 内建的 6 个 Dictionary Renderer 经 `WithRemoteOptions` 包装后，会在 `FormItem` 内自动从字段 Context 取得当前 Schema 字段路径，因此严格类型的 Schema 只需配置 `dict`，无需声明或传入内部 `fieldName`。自定义 Renderer 若直接调用 `useDictionary()`，或将 HOC 脱离 `FormItem` 使用，仍可显式传入 `fieldName`。此边界与 `@schemx/vue` README 的 `useDictionary` / `WithRemoteOptions` 说明一致。

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

## Renderer API

### `input` / `InputRenderer`

- **值与选项：** `InputValue = FieldProps["modelValue"]`；无 Option。
- **Props：** `InputRendererProps extends Omit<SchemxBaseComponentProps, "onChange" | "onBlur" | "value" | "onUpdate:value">`，不直接继承全部 `FieldProps`。
- **Dictionary：** 不支持。
- **行为：** `formatter` 按 `formatTrigger` 处理输入；无确认步骤；`clearable` 使用 Vant Field 清空；`readonly` 改为 Cell 展示，`disabled` 保留输入但阻止编辑。

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
  componentType: "input",
  componentProps: { placeholder: "请输入昵称", clearable: true },
} as const
```

### `text` / `TextRenderer`

- **值与选项：** `TextValue = Extract<InputValue, string>`；无 Option。
- **Props：** `TextRendererProps extends Omit<SchemxInputProps, "value" | "onChange">`，再重写下表字段。
- **Dictionary：** 不支持。
- **行为：** 支持 Field formatter；`type: "password"` 时提供显隐按钮；无确认步骤；`clearable` 可清空；`readonly` 使用 Cell，`disabled` 禁止输入。

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
- **行为：** 强制使用 textarea；`autoSize` 兼容旧拼写并优先于 `autosize`；无确认步骤；可通过继承的 `clearable` 清空；只读时使用 Cell，禁用时隐藏字数统计。

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
- **行为：** `number` 支持小数、`digit` 仅整数；无确认步骤；`clearable` 可清空为空字符串；`readonly` 使用 Cell，`disabled` 禁止输入。

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
- **行为：** `onChange` 可异步返回替代值，等待期间显示 loading；切换即确认；无独立清空；`readonly` 用 Cell 显示 active/inactive 文案，`disabled` 禁止切换。

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
- **行为：** 选中即更新，无额外格式化和确认步骤；无内置清空按钮；`readonly` 用 Cell 映射选项标签，`disabled` 禁用组及选项。

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
- **行为：** 字符串输入按逗号拆分为组选中值，变更回传数组；无确认步骤和内置清空按钮；`readonly` 用 `、` 拼接标签，`disabled` 禁用组及选项。

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
| `onClose`                                       | 声明的关闭回调；当前实现的 Popup 关闭只调用 `onBlur`。        |
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
- **行为：** 单选 / 范围 / 多选日期经 `format` 转为字符串或字符串数组供回调与展示，模型保留 Vant 返回的 `Date` / `Date[]`；确认后关闭，关闭触发 `onBlur`；无内置清空；`readonly` 使用 Cell，`disabled` 阻止打开。

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
- **行为：** 弹窗内先写 `pendingValue`，点击确认才更新模型并依次调用 `onChange` / `onConfirm`；关闭不提交并触发 `onBlur`；无内置清空；`readonly` 使用 Cell，`disabled` 阻止打开。

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
- **行为：** `SelectorRendererProps` 与其基类 `SchemxBaseComponentProps` 都未声明 `multiple`。运行时 `SelectorRenderer` 会把未声明的 attrs 透传给内部 `Selector`，所以直接把 `multiple` 作为 Vue attr 传入时可以启用多选；但严格类型的 Schema `componentProps` 会拒绝该字段，这是当前的类型 / 运行时不一致。点击即更新，无格式化、确认或内置清空；`readonly` 用 Cell，`disabled` 禁止选择。

| 包内显式字段                                    | 类型 / 说明                       |
| ----------------------------------------------- | --------------------------------- |
| `value`                                         | `SelectValue`。                   |
| `onChange`                                      | `(value: SelectValue) => void`。  |
| `options`                                       | `SelectorOption[]`。              |
| `fieldNames`                                    | `{ label?, value?, disabled? }`。 |
| `className`                                     | 根元素类名。                      |
| `readonly` / `readonlyPlaceholder` / `disabled` | 状态与占位。                      |

#### `SelectorProps`（内部 Selector 组件）

根入口同时公开 `SelectorProps`，它描述包内 `Selector.vue` 基础组件，不是 `SelectorRenderer` 本身的 Props。`SelectorRendererProps` 使用 Schemx 的 `value` / `onChange` 契约，并在运行时把值转换为内部组件的 `modelValue`；两者共享 `options`、`fieldNames`、`disabled` 的语义，但只有 `SelectorProps` 声明了 `multiple`。

| 字段         | 类型                                                    | 默认值                                                     | 说明                                                      |
| ------------ | ------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------- |
| `modelValue` | `SelectValue`                                           | `[]`                                                       | 内部 Selector 当前选中值；Renderer 对外对应 `value`。     |
| `options`    | `SelectorOption[]`                                      | `[]`                                                       | 选项列表。                                                |
| `multiple`   | `boolean`                                               | `false`                                                    | 是否多选；当前未进入 `SelectorRendererProps` 的严格类型。 |
| `fieldNames` | `{ label?: string; value?: string; disabled?: string }` | `{ label: "label", value: "value", disabled: "disabled" }` | 选项字段映射。                                            |
| `disabled`   | `boolean`                                               | `false`                                                    | 禁用整个内部 Selector。                                   |

### `sensitiveInput` / `SensitiveInputRenderer`

- **值与选项：** `SensitiveInputValue = string`；无 Option。
- **Props：** `SensitiveInputRendererProps extends Omit<SchemxInputProps, "type" | "value" | "onChange">`。
- **Dictionary：** 不支持。
- **行为：** 默认使用 Renderer 子目录内实现的 `defaultMaskFormatter` 脱敏，展开后 `formatter` 只改变展示、不改变真实回传值；无确认步骤，展开输入继承清空能力；`disabled` 不可展开，`readonly` 仅在 `revealWhenReadonly` 为真时可查看完整值。`defaultMaskFormatter` 不从 `@schemx/vant` 根入口导出。

| 包内重写 / 新增字段           | 类型 / 说明                                               |
| ----------------------------- | --------------------------------------------------------- |
| `value`                       | `SensitiveInputValue`，真实值。                           |
| `onChange`                    | 始终回传真实字符串。                                      |
| `formatter`                   | 完整值展示格式化。                                        |
| `maskFormatter`               | 脱敏格式化；未传时使用子目录内的 `defaultMaskFormatter`。 |
| `defaultRevealed`             | 非受控初始展开状态。                                      |
| `revealed` / `onRevealChange` | 受控展开状态及回调。                                      |
| `revealable`                  | 是否允许展开。                                            |
| `revealText` / `hideText`     | 按钮文案。                                                |
| `revealIcon` / `hideIcon`     | 按钮图标。                                                |
| `focusOnReveal`               | 展开后是否聚焦。                                          |
| `hideOnBlur`                  | 失焦后是否重新脱敏。                                      |
| `revealWhenReadonly`          | 只读时是否允许展开。                                      |

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
- **行为：** 范围值只读展示用 `" - "` 连接；拖动即更新，无确认或内置清空；`readonly` 使用 Cell，`disabled` 由 Vant Slider 阻止交互。

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
- **行为：** 直接遵循 Vant 的数值、整数与小数位规则；点击即更新，无确认；`allowEmpty` 可清空；`readonly` 使用 Cell，`disabled` 禁止调整。

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
- **Props：** 同时继承 Schemx 基础契约与 `Partial<Omit<UploaderProps, "modelValue" | "onUpdate:modelValue" | "imageFit">>`。
- **Dictionary：** 不支持。
- **行为：** 默认 `afterRead` 调用 `uploader`，维护 uploading / done / failed 状态；上传成功或删除后回调 `onChange`；删除即清空对应项；`readonly` 隐藏上传和删除，且无文件时展示 `readonlyPlaceholder`；`disabled` 禁用 Uploader；`disableUpload` 仅隐藏新增入口，保留已有文件删除能力。`multiple` 默认 `true`，也可显式设为 `false`。

| 包内重写 / 新增字段     | 类型 / 说明                                                      |
| ----------------------- | ---------------------------------------------------------------- |
| `value`                 | `UploadValue`。                                                  |
| `onChange`              | `(files: UploadFile[]) => void`。                                |
| `accept`                | 接受的文件类型，默认 `"*"`。                                     |
| `className`             | 根元素类名。                                                     |
| `showUpload`            | 是否显示上传入口。                                               |
| `multiple`              | 是否允许多文件选择，默认 `true`。                                |
| `disableUpload`         | 隐藏上传入口，不影响已有文件的删除。                             |
| `deletable`             | 是否可删除。                                                     |
| `readonly` / `disabled` | 只读、禁用状态。                                                 |
| `readonlyPlaceholder`   | 只读且无文件时由 Cell 展示的占位文本。                           |
| `uploader`              | `(file: File) => Promise<any>`。                                 |
| `propsHttp`             | `{ res?, url?, name? }`；覆盖上传响应中的数据、URL、文件名字段。 |

`propsHttp` 默认值为 `{ res: "data", url: "link", name: "originalName" }`；自定义 `uploader` 的返回值按这三个字段读取，也可通过 `propsHttp` 改为接口实际字段：

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
- **行为：** `options` 可把已有值映射为 Cell 标签路径，也会作为级联弹窗数据源。事件处理代码会在收到 finish 时按 `emitPath` 生成路径、调用 `onConfirm` / `onChange`，关闭触发 `onBlur`；无内置清空；只读 / 禁用不挂载 Popup。

| 包内重写 / 新增字段                             | 类型 / 说明                                                                  |
| ----------------------------------------------- | ---------------------------------------------------------------------------- |
| `value`                                         | `CascaderValue`。                                                            |
| `onConfirm` / `onChange`                        | `(value: CascaderValue) => void`。                                           |
| `onBlur`                                        | Cascader 关闭回调。                                                          |
| `className` / `popupClassName`                  | 根元素 / Popup 类名。                                                        |
| `showAllLevels`                                 | 是否展示全部标签层级，默认 `true`。                                          |
| `emitPath`                                      | 是否返回完整路径，默认 `true`。                                              |
| `fieldNames`                                    | `CascaderFieldNames`。                                                       |
| `separator`                                     | 标签路径分隔符，默认 `" - "`。                                               |
| `options`                                       | `CascaderProps["options"]`；同时用于 Cell 标签映射和级联弹窗。             |
| `title`                                         | Cascader 标题。                                                              |
| `contentAlign`                                  | Cell 内容对齐。                                                              |
| `popupProps`                                    | `Partial<Omit<PopupProps, "show">>`，运行时剔除 `show`。                     |
| `readonly` / `readonlyPlaceholder` / `disabled` | 状态与占位。                                                                 |

> 下例使用 `readonly` 展示 Cell 的标签路径映射；将 `readonly` 改为 `false` 即可打开带有 `options` 的级联弹窗。

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

将 `initialValues` 传给表单后，Cell 可显示“浙江 - 杭州”；示例使用 `readonly: true` 先展示标签路径，编辑态同样会使用这些 `options` 打开级联弹窗。

## 公共组件与工具

### `Cell`

`Cell` 是包内实现的无 Vant 依赖展示组件，统一承担 Renderer 的值展示、空值占位、前后缀、链接箭头，以及 `readonly` / `disabled` 下的非交互状态。它不是 Vant 的 `Cell`，也不会渲染 label、校验信息或表单项外壳。

以下 Props 在发布后的组件类型中均为可选项：

| Prop                  | 类型                                     | 默认值    | 行为                                                         |
| --------------------- | ---------------------------------------- | --------- | ------------------------------------------------------------ |
| `value`               | `string \| number \| boolean`            | `""`      | 展示值；非空时调用 `toString()`。`0` 和 `false` 会正常显示。 |
| `placeholder`         | `string`                                 | `""`      | 可编辑模式的空值占位。                                       |
| `readonlyPlaceholder` | `string`                                 | `"-"`     | `readonly` 模式的空值占位。                                  |
| `disabled`            | `boolean`                                | `false`   | 添加禁用样式，移除按钮语义和键盘 / 点击交互。                |
| `readonly`            | `boolean`                                | `false`   | 添加只读样式，空值改用 `readonlyPlaceholder`，并移除交互。   |
| `isLink`              | `boolean`                                | `true`    | 仅在可编辑模式显示右箭头。                                   |
| `align`               | `"left" \| "right" \| "center" \| "top"` | `"right"` | 值区域对齐方式；兼容输入值 `"top"`，实际按 `"right"` 渲染。  |
| `className`           | `string`                                 | `""`      | 追加到根元素的 class。                                       |
| `customClass`         | `string`                                 | `""`      | 追加到值区域的 class。                                       |
| `prefix`              | `string \| number`                       | `""`      | 前缀后备内容；`prefix` Slot 优先。                           |
| `suffix`              | `string \| number`                       | `""`      | 后缀后备内容；`suffix` Slot 优先。                           |

| Slot      | Slot Props | 用途                                            |
| --------- | ---------- | ----------------------------------------------- |
| `default` | 无         | 覆盖计算后的值或占位内容。                      |
| `prefix`  | 无         | 覆盖 `prefix` Prop；Slot 存在时始终渲染前缀区。 |
| `suffix`  | 无         | 覆盖 `suffix` Prop；Slot 存在时始终渲染后缀区。 |

组件只声明 `click` 事件，签名为 `(event?: MouseEvent) => void`。仅 `readonly === false` 且 `disabled === false` 时，鼠标点击或键盘 `Enter` / `Space` 才会触发；此时根元素具有 `role="button"` 和 `tabindex="0"`。非交互模式设置 `aria-disabled="true"`。`inheritAttrs` 为 `false`，当前模板也没有 `v-bind="$attrs"`，因此未声明 attrs 不会自动透传到根元素。

源码中的 `Props`、`CellAlign` 和 `CellAffixValue` 都是 SFC 私有类型，根入口只发布推导后的 `Cell` 组件类型，并没有名为 `CellProps`、`CellAlign` 或 `CellAffixValue` 的类型导出。当前实现用 `!props.value` 添加 placeholder class，因此 `0` 和 `false` 虽会显示为有效值，仍会带 placeholder 颜色 class；消费端不应把该 class 当作空值判断 API。

实际直接复用该组件的 17 个 Renderer 是：`InputRenderer`、`TextRenderer`、`TextAreaRenderer`、`NumberRenderer`、`SwitchRenderer`、`RadioRenderer`、`CheckboxRenderer`、`DateRenderer`、`CalendarRenderer`、`PickerRenderer`、`SelectPickerRenderer`、`SelectorRenderer`、`SensitiveInputRenderer`、`RateRenderer`、`SliderRenderer`、`StepperRenderer`、`CascaderRenderer`。`UploadRenderer` 不复用 `Cell`。

### 工具函数

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

导入 `@schemx/vant` 根入口会执行 `defaultRenderers` 模块副作用，通过 `@schemx/vue` 的全局 `rendererRegistry.registerAll()` 注册 18 个 Renderer：`input`、`text`、`textarea`、`number`、`switch`、`radio`、`checkbox`、`date`、`calendar`、`picker`、`selectPicker`、`selector`、`sensitiveInput`、`rate`、`slider`、`stepper`、`upload`、`cascader`。

`registerAll()` 会直接覆盖 Registry 中已有的同名项，因此自定义 Renderer 应在导入 `@schemx/vant` 后注册：

```ts
import Schemx, { rendererRegistry } from "@schemx/vant"
import CustomInputRenderer from "./CustomInputRenderer.vue"

rendererRegistry.register("input", CustomInputRenderer)
```

`register()` 默认也允许覆盖；需要保护已有项时可传 `{ override: false }`。此 Registry 是 Vue 包的模块级共享实例，后续同名注册会影响使用该实例的表单。若只导入 `@schemx/vue`，不会触发 Vant 的默认注册；深层导入源码既不保证副作用，也不属于发布出口。

`DEFAULT_RENDERER_TYPES` 是按上述顺序排列的只读字面量元组，适合能力枚举、文档生成和类型推导。当前注册模块仍显式维护组件映射，并不是遍历该元组完成注册；该常量也不代表 Renderer 一定处于可编辑模式。实际交互仍由字段的 `readonly` / `disabled`、各 Renderer 实现及 `resolveRendererMode()` 共同决定。

## 类型参考

根入口自有 46 个 Renderer 辅助类型。每个 Props、Value、Option 和 FieldNames 的字段与限制已在对应的 [Renderer API](#renderer-api) 小节说明；这里按导出符号逐项索引，避免把同一契约重复成另一份可能漂移的字段表。

| Renderer       | 类型导出                      | 用途                               |
| -------------- | ----------------------------- | ---------------------------------- |
| Input          | `InputRendererProps`          | Input Renderer 的 Props。          |
| Input          | `InputValue`                  | Input Renderer 的值类型。          |
| Text           | `TextRendererProps`           | Text Renderer 的 Props。           |
| Text           | `TextValue`                   | Text Renderer 的字符串值。         |
| TextArea       | `TextAreaRendererProps`       | TextArea Renderer 的 Props。       |
| TextArea       | `TextAreaAutosize`            | TextArea 自动高度配置。            |
| TextArea       | `TextAreaValue`               | TextArea Renderer 的字符串值。     |
| Checkbox       | `CheckboxRendererProps`       | Checkbox Renderer 的 Props。       |
| Checkbox       | `CheckboxOption`              | Checkbox 单个选项结构。            |
| Checkbox       | `CheckboxValue`               | Checkbox Renderer 的数组值。       |
| Date           | `DateRendererProps`           | Date Renderer 的 Props。           |
| Date           | `DateValue`                   | Date Renderer 的值类型。           |
| Calendar       | `CalendarRendererProps`       | Calendar Renderer 的 Props。       |
| Calendar       | `CalendarValue`               | Calendar 单日 / 范围 / 多选值。    |
| Number         | `NumberRendererProps`         | Number Renderer 的 Props。         |
| Number         | `NumberValue`                 | Number Renderer 的数值或空值类型。 |
| Picker         | `PickerRendererProps`         | Picker Renderer 的 Props。         |
| Picker         | `PickerFieldNames`            | Picker 选项字段映射。              |
| Picker         | `PickerValue`                 | Picker Renderer 的选中值数组。     |
| Radio          | `RadioRendererProps`          | Radio Renderer 的 Props。          |
| Radio          | `RadioOption`                 | Radio 单个选项结构。               |
| Radio          | `RadioValue`                  | Radio Renderer 的值类型。          |
| Rate           | `RateRendererProps`           | Rate Renderer 的 Props。           |
| Rate           | `RateValue`                   | Rate Renderer 的评分值。           |
| Slider         | `SliderRendererProps`         | Slider Renderer 的 Props。         |
| Slider         | `SliderValue`                 | Slider 单值或范围值。              |
| Stepper        | `StepperRendererProps`        | Stepper Renderer 的 Props。        |
| Stepper        | `StepperValue`                | Stepper Renderer 的值类型。        |
| Switch         | `SwitchRendererProps`         | Switch Renderer 的 Props。         |
| Switch         | `SwitchValue`                 | Switch Renderer 的值类型。         |
| Upload         | `UploadRendererProps`         | Upload Renderer 的 Props。         |
| Upload         | `UploadFile`                  | 单个上传文件项。                   |
| Upload         | `UploadValue`                 | 上传文件项数组。                   |
| Cascader       | `CascaderRendererProps`       | Cascader Renderer 的 Props。       |
| Cascader       | `CascaderFieldNames`          | Cascader 选项字段映射。            |
| Cascader       | `CascaderValue`               | Cascader 路径或末级值数组。        |
| Selector       | `SelectorRendererProps`       | Selector Renderer 的 Props。       |
| Selector       | `SelectorOption`              | Selector 单个选项结构。            |
| Selector       | `SelectorProps`               | 包内 Selector 基础组件 Props。     |
| Selector       | `SelectValue`                 | Selector 单选或多选值。            |
| SelectPicker   | `SelectPickerFieldNames`      | SelectPicker 选项字段映射。        |
| SelectPicker   | `SelectPickerOption`          | SelectPicker 单个选项结构。        |
| SelectPicker   | `SelectPickerRendererProps`   | SelectPicker Renderer 的 Props。   |
| SelectPicker   | `SelectPickerValue`           | SelectPicker 单选或多选值。        |
| SensitiveInput | `SensitiveInputRendererProps` | SensitiveInput Renderer 的 Props。 |
| SensitiveInput | `SensitiveInputValue`         | SensitiveInput 的真实字符串值。    |

`DEFAULT_RENDERER_TYPES` 是运行时值，不是类型；`defaultMaskFormatter` 当前不属于根入口公开 API。

## Vue 与 Core API

Vant 根入口的 `default` 与命名 `SchemxForm` 都直接引用 `@schemx/vue` 的默认表单组件；此外，`export * from "@schemx/vue"` 原样传递 Vue 和 Core 的公开导出。它们的所有权仍分别属于 Vant、Vue 和 Core，不应被描述成 Vant 自有 API。

注意命名差异：Vue 根入口的组件别名是小写开头的 `schemxForm`，没有命名 `SchemxForm`；Vant 才额外增加命名别名 `SchemxForm`。在 Vant 根入口中，`default === SchemxForm`，并且二者也与传递进来的 `schemxForm` 指向同一组件。

使用 `dependencies` 可以根据其他字段值动态调整字段状态：

```ts
const schemas = [
  {
    name: "accountType",
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
    componentType: "input",
    dependencies: {
      triggerFields: ["accountType"],
      visible: (values: { accountType?: string }) => values.accountType === "company",
      required: (values: { accountType?: string }) => values.accountType === "company",
    },
  },
]
```

通过组件 `ref` 可调用 `SchemxInstance`。它包含值、快照、初始值、touched、pending、校验、提交与重置、响应式 effect、Schema 更新、默认配置、view、Renderer / Validator 注册和 `destroy` 等完整实例能力；实例契约以 `@schemx/core` 的 `SchemxInstance` 类型为准。

## 导出清单

下列列表按来源说明当前公开 API。导出总数不在文档中固定统计；新增 Renderer、Hook 或 Core 类型后，请以包根入口和 `package.json` 的 `exports` 为准。

### Vant 自有运行时值（含 `default`）

| 分类            | 导出                      | 用途                                                    |
| --------------- | ------------------------- | ------------------------------------------------------- |
| 表单组件        | `SchemxForm`              | Vue 默认表单组件的 Vant 命名别名。                      |
| 表单组件        | `default`                 | Vue 默认表单组件；不计入 28 个命名值。                  |
| Renderer        | `InputRenderer`           | `input` 字段 Renderer。                                 |
| Renderer        | `TextRenderer`            | `text` 字段 Renderer。                                  |
| Renderer        | `TextAreaRenderer`        | `textarea` 字段 Renderer。                              |
| Renderer        | `NumberRenderer`          | `number` 字段 Renderer。                                |
| Renderer        | `SwitchRenderer`          | `switch` 字段 Renderer。                                |
| Renderer        | `RadioRenderer`           | `radio` 字段 Renderer。                                 |
| Renderer        | `CheckboxRenderer`        | `checkbox` 字段 Renderer。                              |
| Renderer        | `DateRenderer`            | `date` 字段 Renderer。                                  |
| Renderer        | `CalendarRenderer`        | `calendar` 字段 Renderer。                              |
| Renderer        | `PickerRenderer`          | `picker` 字段 Renderer。                                |
| Renderer        | `SelectPickerRenderer`    | `selectPicker` 字段 Renderer。                          |
| Renderer        | `SelectorRenderer`        | `selector` 字段 Renderer。                              |
| Renderer        | `SensitiveInputRenderer`  | `sensitiveInput` 字段 Renderer。                        |
| Renderer        | `RateRenderer`            | `rate` 字段 Renderer。                                  |
| Renderer        | `SliderRenderer`          | `slider` 字段 Renderer。                                |
| Renderer        | `StepperRenderer`         | `stepper` 字段 Renderer。                               |
| Renderer        | `UploadRenderer`          | `upload` 字段 Renderer。                                |
| Renderer        | `CascaderRenderer`        | `cascader` 字段 Renderer；当前交互限制见对应 API 小节。 |
| 公共组件        | `Cell`                    | Renderer 共用的状态和值展示组件。                       |
| Renderer 元数据 | `DEFAULT_RENDERER_TYPES`  | 18 个默认 Renderer key 的只读元组。                     |
| 工具            | `getFieldProps`           | 从 attrs 读取属性并处理 nullish 默认值。                |
| 工具            | `isEmptyDisplayValue`     | 判断展示层空值。                                        |
| 工具            | `getReadonlyDisplayValue` | 生成保留有效 falsy 值的只读展示值。                     |
| 工具            | `resolveRendererMode`     | 解析 editable / disabled / readonly 模式。              |
| 工具            | `isRendererInteractive`   | 判断 Renderer 模式是否允许交互。                        |
| 工具            | `findTreeItem`            | 查找树节点并返回 label / value 路径。                   |
| 工具            | `getFileName`             | 从 URL 或路径提取文件名。                               |

### Vant 自有类型

Renderer 类型的逐项用途见 [类型参考](#类型参考)，工具类型的结构见 [工具函数](#工具函数)。

| 分类          | 导出                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Renderer 类型 | `InputRendererProps`、`InputValue`、`TextRendererProps`、`TextValue`、`TextAreaRendererProps`、`TextAreaAutosize`、`TextAreaValue`、`CheckboxRendererProps`、`CheckboxOption`、`CheckboxValue`、`DateRendererProps`、`DateValue`、`CalendarRendererProps`、`CalendarValue`、`NumberRendererProps`、`NumberValue`、`PickerRendererProps`、`PickerFieldNames`、`PickerValue`、`RadioRendererProps`、`RadioOption`、`RadioValue`、`RateRendererProps`、`RateValue`、`SliderRendererProps`、`SliderValue`、`StepperRendererProps`、`StepperValue`、`SwitchRendererProps`、`SwitchValue`、`UploadRendererProps`、`UploadFile`、`UploadValue`、`CascaderRendererProps`、`CascaderFieldNames`、`CascaderValue`、`SelectorRendererProps`、`SelectorOption`、`SelectorProps`、`SelectValue`、`SelectPickerFieldNames`、`SelectPickerOption`、`SelectPickerRendererProps`、`SelectPickerValue`、`SensitiveInputRendererProps`、`SensitiveInputValue` |
| 工具类型      | `RendererMode`、`FindTreeItemResult`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

### Vue 自有传递运行时值

| 分类       | 导出                      | 用途                                                    |
| ---------- | ------------------------- | ------------------------------------------------------- |
| 表单组件   | `schemxForm`              | Vue 可安装表单组件，与 Vant 的 `default` 指向同一对象。 |
| 组件       | `FormItem`                | 渲染字段或分组 ViewSchema。                             |
| 组件       | `FormGroup`               | 渲染分组 ViewSchema。                                   |
| HOC        | `WithRemoteOptions`       | 为 Renderer 接入 Dictionary。                           |
| Registry   | `rendererRegistry`        | Vue 全局 Renderer Registry；Vant 默认注册写入此实例。   |
| Registry   | `validationRuleRegistry`  | Vue 全局 ValidationRuleRegistry。                       |
| Hook       | `useForm`                 | 创建并按 Vue scope 销毁表单。                           |
| Context    | `createFormContext`       | 提供表单实例。                                          |
| Context    | `useFormContext`          | 读取表单实例。                                          |
| Hook       | `useField`                | 创建 Vue 字段控制器。                                   |
| Context    | `createFieldContext`      | 提供字段控制器。                                        |
| Context    | `useFieldContext`         | 读取字段控制器。                                        |
| Context    | `createFormConfigContext` | 提供表单展示配置。                                      |
| Context    | `useFormConfigContext`    | 读取表单展示配置。                                      |
| Watch      | `useWatch`                | 统一分发 Vue Watch。                                    |
| Watch      | `useWatchField`           | 单字段 Vue Watch。                                      |
| Watch      | `useWatchFields`          | 多字段 Vue Watch。                                      |
| Watch      | `useWatchAll`             | 全表 Vue Watch。                                        |
| Dictionary | `useDictionary`           | 管理函数式选项源。                                      |
| Effect     | `useEffect`               | 创建并自动清理 Core effect。                            |
| Vue 响应式 | `useStableRef`            | 建立浅比较稳定 Ref。                                    |
| ViewSchema | `useViewSchemas`          | 桥接 ViewSchemas 为 Ref。                               |

### Vue 自有传递类型

| 分类            | 导出                   | 用途                                       |
| --------------- | ---------------------- | ------------------------------------------ |
| Context 类型    | `FormContextProps`     | 表单展示 Context。                         |
| Dictionary 类型 | `SchemxDictionary`     | 函数式选项源配置。                         |
| 插件类型        | `SchemxInstallOptions` | 当前为空的安装选项。                       |
| Dictionary 类型 | `SchemxWithDictionary` | 为 Renderer Props 增加可选 `dict`。        |
| Dictionary 类型 | `UseDictionaryReturn`  | `useDictionary()` 的响应式状态与控制方法。 |
| 表单类型        | `SchemxFormProps`      | Vue 表单组件 Props 类型。                  |
| 字段类型        | `FieldInstance`        | Vue Ref / Computed 桥接后的字段控制器类型。 |

这些 Vue API 的完整契约与边界见 [Vue README](../vue)。

### 经 Vue 传递的 Core 运行时值

| 分类          | 导出                           | 用途                          |
| ------------- | ------------------------------ | ----------------------------- |
| 表单          | `createForm`                   | 创建 Core 表单。              |
| 字段          | `createField`                  | 创建 Core 字段控制器。        |
| Schema source | `createSchemas`                | 创建可更新 Schema source。    |
| Schema source | `isSchemxSchemas`              | 判断 Schema source。          |
| Effect        | `createEffect`                 | 创建 Core effect。            |
| 配置          | `configureSchemx`              | 设置后续 Form 使用的全局默认配置。 |
| Watch         | `createWatch`                  | 分发 Core Watch。             |
| Watch         | `createWatchField`             | 单字段 Core Watch。           |
| Watch         | `createWatchFields`            | 多字段 Core Watch。           |
| Watch         | `createWatchAll`               | 全表 Core Watch。             |
| Registry      | `createRendererRegistry`       | 创建 Renderer Registry。      |
| Registry      | `createValidationRuleRegistry` | 创建 ValidationRuleRegistry。 |
| Validator     | `createValidator`              | 创建底层 Validator。          |
| Schema 守卫   | `isBaseSchema`                 | 判断原始普通字段。            |
| Schema 守卫   | `isGroupSchema`                | 判断原始 Group。              |
| Schema 守卫   | `isDependencySchema`           | 判断原始 Dependency。         |
| Schema 守卫   | `isBaseResolvedSchema`         | 判断解析后普通字段。          |
| Schema 守卫   | `isGroupResolvedSchema`        | 判断解析后 Group。            |
| 路径          | `getByPath`                    | 读取嵌套路径。                |
| 路径          | `setByPath`                    | 写入嵌套路径。                |
| 路径          | `collectObjectPathsByLeaf`     | 收集叶子路径。                |

### 经 Vue 传递的 Core 类型

| 分类               | 导出                            | 用途                                    |
| ------------------ | ------------------------------- | --------------------------------------- |
| Effect             | `CleanupFn`                     | effect cleanup 函数。                   |
| Effect             | `EffectCallback`                | effect callback。                       |
| Effect             | `CreateEffectReturn`            | effect dispose 函数。                   |
| Watch              | `CreateWatchOptions`            | Watch 选项。                            |
| Watch              | `CreateWatchReturn`             | Watch 取消函数。                        |
| Watch              | `WatchFieldCallback`            | 单字段 Watch callback。                 |
| Watch              | `WatchFieldsCallback`           | 多字段 Watch callback。                 |
| Watch              | `WatchAllCallback`              | 全表 Watch callback。                   |
| 表单               | `CreateFormOptions`             | Core 表单创建选项。                     |
| 表单               | `SchemxInstance`                | Core 表单实例接口。                     |
| 表单               | `SchemxProps`                   | UI 适配层表单 Props。                   |
| 表单               | `SchemxGlobalContext`           | Core 全局字段默认配置。                 |
| 表单               | `SchemxContext`                 | Core 实例级高级上下文。                 |
| 基础               | `Values`                        | 表单值基础约束。                        |
| 基础               | `Dynamic`                       | 静态值或同步 / 异步值函数。             |
| 路径               | `NamePath`                      | 类型安全字段路径。                      |
| 路径               | `FieldValue`                    | 从路径提取字段值。                      |
| 工具类型           | `DeepReadonly`                  | 深层只读类型。                          |
| 工具类型           | `CSSProperties`                 | CSS 属性类型。                          |
| Schema source      | `SchemxSchemas`                 | 可更新 Schema source。                  |
| Schema source      | `SchemxSchemasInput`            | Schema 数组或 source 联合。             |
| Schema source      | `SchemxSchemasListener`         | Schema source listener。                |
| 字段               | `SchemxFieldInstance`           | Core 字段控制器。                       |
| Schema             | `SchemxBase`                    | 普通字段基础接口。                      |
| Schema             | `SchemxBaseField`               | 按 Renderer key 分布的字段联合。        |
| Schema             | `SchemxGroupField`              | 原始 Group Schema。                     |
| Schema             | `SchemxDependencyField`         | 原始 Dependency Schema。                |
| Schema             | `SchemxField`                   | 全部原始 Schema 联合。                  |
| Schema             | `SchemxResolvedField`           | 解析后字段 / Group 联合。               |
| Schema             | `SchemxBaseComponentProps`      | Renderer 公共 Props。                   |
| Schema             | `SchemxComponentProps`          | Renderer 专属与公共 Props。             |
| Schema             | `SchemxFormItemProps`           | 表单项字段配置。                        |
| 扩展               | `SchemxFieldDefinition`         | 普通字段声明合并接口。                  |
| 扩展               | `SchemxGroupFieldDefinition`    | Group 声明合并接口。                    |
| 依赖               | `SchemxDependencies`            | 字段动态依赖配置。                      |
| 依赖               | `SchemxConditionFn`             | 动态属性条件函数。                      |
| 依赖               | `SchemxDependenciesStaticProps` | 依赖函数静态返回值映射。                |
| ViewSchema         | `SchemxViewDebugMeta`           | ViewSchema 诊断元数据。                 |
| ViewSchema         | `SchemxViewFieldSchema`         | 字段渲染投影。                          |
| ViewSchema         | `SchemxViewGroupSchema`         | Group 渲染投影。                        |
| ViewSchema         | `SchemxViewSchema`              | 字段 / Group 投影联合。                 |
| 配置               | `SchemxConfig`                  | Core 全局默认配置。                     |
| 配置               | `SchemxValidationConfig`        | Core 全局校验 adapter 配置。            |
| Renderer           | `SchemxRendererKey`             | Renderer key 类型。                     |
| Renderer           | `SchemxRendererDefinition`      | Renderer Props 声明合并接口。           |
| Renderer Registry  | `RendererRegistry`              | Renderer Registry 实例类型。            |
| Renderer Registry  | `RegistryOptions`               | 注册覆盖选项（renderer 与 rule 共享）。 |
| Renderer Registry  | `RendererMap`                   | Renderer 批量映射。                     |
| Validator          | `Validator`                     | 底层 Validator 实例类型。               |
| Validator          | `ValidationResult`              | 校验成功 / 失败联合。                   |
| Validator          | `ValidationSuccess`             | 校验成功结果。                          |
| Validator          | `ValidationFailure`             | 普通校验失败结果。                      |
| Validator          | `ValidationCancelled`           | 被更新校验或销毁操作中止的结果。        |
| Validator          | `ValidationError`               | 校验失败详情。                          |
| Validator          | `FieldValidationError`          | 单字段错误。                            |
| Validator          | `FormValidationError`           | 表单级错误。                            |
| Validator          | `ValidationRuleContext`         | 原生规则执行上下文。                    |
| Validator          | `ValidationRuleIssue`           | 单条校验问题。                          |
| Validator          | `ValidationRuleResult`          | 单条规则执行结果。                      |
| Validator          | `AdapterRule`                   | 第三方 adapter 创建的品牌规则。        |
| Validator          | `ValidationAdapter`             | 第三方校验 adapter 契约。               |
| Validator          | `ValidationTrigger`             | 校验触发时机。                          |
| Validator          | `StandardSchemaV1`              | Standard Schema v1 协议。               |
| Rule               | `ValidationRuleDefinition`      | 自定义规则声明合并接口。                |
| Rule               | `ValidationRuleName`            | 声明合并推导的规则 key。                |
| Rule               | `RequiredOptions`               | 必填消息与空值判断配置。                |
| Rule               | `FieldRules`                    | Standard Schema、内置或自定义规则。     |
| Validator Registry | `ValidationRuleRegistry`        | ValidationRuleRegistry 实例类型。       |
| Validator Registry | `ValidationRuleFactory`         | 按字段 Schema 生成规则的工厂。          |
| Validator Registry | `ValidationRuleEntry`           | Standard Schema 或工厂联合。            |
| Validator Registry | `ValidationRuleMap`             | 规则名到条目的批量映射。                |

这些 Core API 由 Vue 传递，并非 Vant Renderer 能力；完整签名、语义和已知边界见 [Core README](../core)。

相关包：[`@schemx/core`](../core)、[`@schemx/vue`](../vue)。
