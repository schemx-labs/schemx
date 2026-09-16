# @schemx/vue

`@schemx/vue` 将 `@schemx/core` 的表单实例和 ViewSchemas 渲染为 Vue 3 组件树，包含 Group、Dependency 和 Dynamic 数组的递归渲染。它不绑定具体 UI 组件库，适合接入业务组件、设计系统或新的 UI adapter。

如果项目使用 Vant，推荐直接安装 [`@schemx/vant`](../vant)。该包已经注册常用的移动端表单 Renderer。

适用于使用自研组件或设计系统的 Vue 3 项目。该包提供表单组件、响应式 Hook 和 Renderer 注册机制，但不内置具体输入控件；每种 `componentType` 都需要由应用自行注册 Renderer。

## 安装与样式

```bash
pnpm add @schemx/vue vue
```

`@schemx/core` 是 `@schemx/vue` 的运行时依赖，会随安装自动安装；`vue` 是 peer dependency，业务项目需要显式安装。若业务代码直接导入 `@schemx/core` 或其子路径，也应在项目中显式声明该包。

ESM 入口 `@schemx/vue` 会通过入口模块自动加载基础样式，常规 Vite / Vue ESM 项目不需要再次导入 CSS。CommonJS 入口不会保留这条 CSS import；直接使用 CommonJS，或构建工具没有处理入口 CSS import 时，需要显式导入公开的样式子路径：

```ts
import "@schemx/vue/style.css"
```

不要从 `src/styles` 或 `dist` 的内部路径导入样式；包的 `exports` 只公开根入口和 `./style.css`。

## 快速开始

`@schemx/vue` 默认不提供具体输入控件。先注册 Renderer，再渲染表单：

```vue
<script setup lang="ts">
  import { markRaw, ref } from "vue"

  import Schemx, { rendererRegistry } from "@schemx/vue"
  import type { SchemxField } from "@schemx/vue"

  import InputRenderer from "./components/InputRenderer.vue"

  type ProfileValues = {
    nickname: string
  }

  rendererRegistry.register("input", markRaw(InputRenderer))

  const formData = ref<ProfileValues>({
    nickname: "",
  })

  const schemas: SchemxField<ProfileValues>[] = [
    {
      name: "nickname",
      label: "昵称",
      componentType: "input",
      required: true,
      placeholder: "请输入昵称",
    },
  ]
</script>

<template>
  <Schemx v-model="formData" :initial-values="formData" :schemas="schemas" />
</template>
```

这里同时传入 `initialValues` 是为了在 `modelValue` 为空时提供初始值。非空的 `modelValue` 会优先作为内部表单的初始快照；之后外部替换 `modelValue` 也会同步到内部表单。详见下一节的受控行为说明。

## Schemx 组件

默认导出和命名导出 `schemxForm` 指向同一个可安装组件：

```ts
import Schemx, { schemxForm } from "@schemx/vue"

console.log(Schemx === schemxForm) // true
```

根入口当前没有名为 `SchemxForm` 的命名导出。可以自行给默认导入命名，但不要依赖 `@schemx/vue/src/*` 等深层路径。

### Props

`Schemx` 的公开 Props 类型为 Vue 层的 `SchemxFormProps<T>`，由 Core 表单选项和 Vue 专属 Props 组合而成。

| Prop                     | 类型                                             | 默认值                    | 说明                                                                                                                            |
| ------------------------ | ------------------------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `schemas`                | `SchemxSchemasInput<T>`                          | `[]`                      | 表单 Schema；可传字段数组或 `createSchemas()` 返回的 Schema source，运行时缺省为空数组                                          |
| `modelValue`             | `T`                                              | `{}`                      | `v-model` 的输入端；非空值参与初始快照，后续替换会同步到内部表单，字段变化会通过 `update:modelValue` 输出                       |
| `initialValues`          | `T`                                              | `{}`                      | 创建内部表单时的初始值，也是 `reset()` 的还原基准                                                                               |
| `form`                   | `SchemxInstance<T>`                              | `undefined`               | 外部表单实例；传入后组件不再创建实例，但仍会提供 Vue 上下文并同步 `schemas`；组件级回调不会写入该实例，`v-model` 仍监听实例变化 |
| `fieldRules`             | `SchemxFieldRulesMap<T>`                         | `undefined`               | 按字段路径配置的字段规则兜底；字段自身 `rules` 或动态规则优先                                                                   |
| `rendererProps`          | `SchemxRendererPropsMap<T>`                      | `undefined`               | 按 Renderer 类型设置静态默认 Props；字段 `componentProps` 与 Runtime 注入值优先                                                 |
| `rendererRegistry`       | `RendererRegistry`                               | 全局 `rendererRegistry`   | 当前表单使用的 Renderer Registry                                                                                                |
| `defaultRendererType`    | `SchemxRendererKey`                              | `undefined`               | 创建内部表单且未传 `rendererRegistry` 时的默认 Renderer 类型；Vue 全局 Registry 存在时由该 Registry 的 fallback 决定            |
| `presetRuleRegistry`     | `PresetRuleRegistry`                             | 全局 `presetRuleRegistry` | 当前表单使用的预设规则 Registry                                                                                                 |
| `validatorAdapters`      | `readonly ValidationAdapterOption[]`             | `[]`                      | 当前表单使用的第三方校验 adapter；创建内部 Form 时参与配置合并并传递给 Core                                                     |
| `required`               | `RequiredConfig`                                 | `undefined`               | 表单级必填默认值；字段自身配置优先，普通 `rules` 不会推导必填或显示星号                                                         |
| `readonly`               | `boolean`                                        | `undefined`               | 表单级只读默认值；字段自身配置优先                                                                                              |
| `disabled`               | `boolean`                                        | `undefined`               | 表单级禁用默认值；字段自身配置优先                                                                                              |
| `visible`                | `boolean`                                        | `true`                    | 表单级可见性默认值；字段自身配置优先                                                                                            |
| `labelIcon`              | `string`                                         | `undefined`               | 表单级标签图标默认值；会进入字段 ViewSchema，具体是否渲染取决于适配组件                                                         |
| `labelAlign`             | `"left" \| "center" \| "right"`                  | `undefined`               | 表单级标签对齐默认值；字段自身配置优先，均未配置时为 `"left"`                                                                   |
| `labelPosition`          | `"left" \| "top" \| "right"`                     | `undefined`               | 表单级标签位置默认值；字段自身配置优先，均未配置时为 `"left"`                                                                   |
| `labelWidth`             | `string`                                         | `undefined`               | 表单级标签宽度默认值；字段自身配置优先，均未配置时为 `"auto"`                                                                   |
| `contentAlign`           | `"left" \| "center" \| "right"`                  | `undefined`               | 表单级内容对齐默认值；用于解析 Renderer 的 `align`，字段自身配置优先                                                            |
| `validationTrigger`      | `ValidationTrigger \| ValidationTrigger[]`       | `["blur", "change"]`      | 表单级校验触发方式默认值；字段自身配置优先                                                                                      |
| `colon`                  | `boolean`                                        | `undefined`               | 表单级标签冒号默认值；字段自身配置优先，均未配置时为 `true`                                                                     |
| `onFinish`               | `(values: Readonly<T>) => void \| Promise<void>` | `undefined`               | `submit()` 校验通过后的回调 Prop                                                                                                |
| `onFinishFailed`         | `(failure: ValidationFailure<T>) => void`        | `undefined`               | `submit()` 校验失败后的回调 Prop                                                                                                |
| `onReset`                | `() => void`                                     | `undefined`               | 内部表单完整 `reset()` 完成后的回调；不在 `resetFields()` 后触发                                                                |
| `onLoadingChange`        | `(loading: boolean) => void`                     | `undefined`               | 内部表单提交开始和结束时的回调                                                                                                  |
| `onValuesChange`         | `(changedValues, latestSnapshot) => void`        | `undefined`               | 字段值变化后的回调 Prop                                                                                                         |
| `onFieldsChange`         | `(changedFields, allFields) => void`             | `undefined`               | 字段路径变化后的回调 Prop                                                                                                       |
| `onRuleError`            | `FormCallbackOptions<T>["onRuleError"]`          | `undefined`               | 规则解析异常回调；内部创建实例时当前不会透传，需在外部 `form` 实例上配置                                                        |
| `lifecycleHooks`         | `FormLifecycleOptions["lifecycleHooks"]`         | `undefined`               | Core Form 的 Runtime 生命周期钩子；当前 `<Schemx>` 创建内部实例时不会透传，需通过 `useForm()` 或 `createForm()` 配置。 |
| `schedulerOptions`       | `SchedulerOptions`                               | `undefined`               | Scheduler 时间片与 idle 队列配置                                                                                                |
| `validationConcurrency`  | `number`                                         | `8`                       | 整表校验时同时运行的字段数                                                                                                      |
| `loading`                | `boolean`                                        | `undefined`               | 覆盖内置操作区显示的提交状态，不改变 Core 的真实提交状态                                                                        |
| `submitter` / `resetter` | `boolean \| SchemxFormActionConfig`              | `true`                    | 控制内置提交 / 重置按钮；默认渲染，设为 `false` 隐藏，配置可设置 `text` 和 `buttonProps`                                        |
| `class`                  | `string`                                         | `""`                      | 添加到根 `.schemx` 元素的类名                                                                                                   |
| `style`                  | `StyleValue`                                     | `{}`                      | 绑定到根 `.schemx` 元素                                                                                                         |

上述 Schema 默认配置都会参与字段规范化：Core 负责 `required`、`readonly`、`disabled`、`visible` 和校验触发方式，Vue 适配层负责标签、内容对齐、冒号和必填标记等展示默认值。Registry、默认 Renderer 和 `validatorAdapters` 则按表单显式配置 → 当前 App 安装配置 → Vue 模块级 Registry → Core 模块级配置 → Core 内置默认值解析。必填只能通过 `required: true` 或 `RequiredOptions` 表达；普通 `rules` 只负责执行校验，不会显示必填星号。传入 `form` 时，`initialValues`、Registry 和所有表单回调都由外部实例的创建者配置；组件不会用同名 Props 重建 Core Form，但会通过 Vue bridge 包装该实例，并同步 `schemas` 与组件声明的 schema 配置。

`ConfigProvider` 的 `schemaConfig` 和 `colComponent` 更新会同步到已挂载的内部 `<Schemx>`；Registry、校验 adapter 和默认 Renderer 类型仍在 Form 创建时解析。

当未显式传入 `rendererRegistry` 时，Vue `useForm()` 会使用全局 Registry；该 Registry 默认以 `input` 作为 fallback。因此若要让 `<Schemx :default-renderer-type="...">` 生效，应传入独立 Registry，或直接对 Vue 导出的全局 Registry 调用 `setFallback()`。传入外部 `form` 时，Renderer 配置由该实例决定。

### `v-model`、`initialValues` 与事件

`initialValues` 是内部 Store 的初始快照和 `reset()` 基准。`modelValue` 按 Vue 约定作为输入和输出：

- 创建内部实例时，非空 `modelValue` 会整体作为内部表单初始值，优先于 `initialValues`。
- 外部替换 `modelValue` 后，组件会调用 `setFieldsValue()` 同步内部表单。
- 传入外部 `form` 时，非空 `modelValue` 会在组件挂载时先写入该实例；空对象仍视为未提供。
- 内部或外部 `form` 的字段变化都会发出 `update:modelValue`，值为最新表单快照；同步来自 `modelValue` 的变化不会重复发出该事件。
- 外部 `form` 上的组件级 Schema Prop 撤销后会回到 Core 默认值，不保证恢复外部实例挂载前的同名配置。
- 传入外部 `form` 时，组件级 `onFinish`、`onFinishFailed`、`onValuesChange` 和 `onFieldsChange` 不会重新配置该实例；这些回调应在创建外部实例时配置。
- 传入外部 `form` 时，`onReset` 与 `onLoadingChange` 同样不会重新配置该实例；请在创建该实例时传入回调。
- `onFinish`、`onFinishFailed`、`onValuesChange` 和 `onFieldsChange` 是声明过的回调 Props，不在 `defineEmits` 的事件列表中。模板中的 `@finish` 等写法会按 Vue listener Prop 规则映射到这些 Props，但 TypeScript 用户更适合显式传回调。

内部表单模式会把 `props.onFinish(values)` 的返回值交给 Core，因此 `submit()` 会等待业务回调返回的 Promise；业务回调同步抛错或异步拒绝时，`submit()` 也会拒绝。传入外部 `form` 时组件不会重新配置这层回调，等待和错误传播完全取决于外部实例创建者；Core `createForm()` 同样会等待直接传入的 `onFinish`。

唯一通过 `defineEmits` 声明的组件事件如下：

| 事件                | 参数         | 触发时机                             |
| ------------------- | ------------ | ------------------------------------ |
| `update:modelValue` | `(value: T)` | 内部表单的 `onValuesChange` 被调用后 |

如需程序化更新外部表单，可持有 `ref` 或外部 `form` 并显式调用 `setFieldsValue()`；普通 `v-model` 已负责值的双向同步。

### Slots

`Schemx` 把收到的所有 Slots 继续传给每个 `Field` 与 `Group`。嵌套字段名可直接作为 Slot 前缀，例如 `user.nameLabel`。

| Slot 名称           | Slot Props                            | 行为                                                                                                     |
| ------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `{name}`            | `SchemxFieldSlotProps`                | 替换 Field wrapper 内的默认内容；保留 wrapper、其 class/style 和透传属性                                 |
| `{name}Label`       | `SchemxFieldSlotProps`                | 替换标签区域                                                                                             |
| `{name}Before`      | `SchemxFieldSlotProps`                | 渲染在 Renderer 前                                                                                       |
| `{name}Content`     | `SchemxFieldContentSlotProps`         | 替换控件内容区域；额外提供默认 Renderer 的 `columnElement`                                               |
| `{name}After`       | `SchemxFieldSlotProps`                | 渲染在 Renderer 后、错误区域前                                                                           |
| `{name}Error`       | `SchemxFieldErrorSlotProps`           | 替换错误区域；额外提供当前错误列表 `errors`                                                              |
| `{name}:{slotName}` | 原样传给 Renderer                     | 去掉 `{name}:` 前缀后作为 Renderer 命名 Slot；同一数组路径的前缀为 `user.name:`，例如 `user.name:prefix` |
| `{groupKey}Header`  | `SchemxGroupSlotProps`                | 替换分组 Header 内部内容；保留默认的无障碍与折叠容器                                                     |
| `{groupKey}Label`   | `SchemxGroupSlotProps`                | 替换默认分组标题；保留默认折叠箭头                                                                       |
| `{groupKey}Content` | `SchemxGroupSlotProps`                | 替换分组 Body 内的子字段布局                                                                             |
| `submitter`         | `{ form, loading, disabled, submit }` | 替换内置提交按钮。                                                                                       |
| `resetter`          | `{ form, loading, disabled, reset }`  | 替换内置重置按钮。                                                                                       |

字段名和 `Label` / `Before` / `Content` / `After` / `Error` 组合支持 camelCase 与 kebab-case 互查。子 Renderer Slot 的字段名前缀也支持这两种形式。

字段 Slot 的规范公共参数为 `{ schema, componentProps, value, field, form }`；不再把 Schema 或 Renderer Props 展开到 Slot 参数顶层。这样区域专属参数始终清晰可辨：`Content` 增加 `columnElement`，`Error` 增加 `errors`。这些公开类型均可从 `@schemx/vue` 导入。

```vue
<Schemx :schemas="schemas">
  <template #nicknameLabel="{ schema }">
    <strong>{{ schema.label }}</strong>
  </template>

  <template #nicknameBefore>
    <span>@</span>
  </template>

  <template #nicknameAfter="{ value }">
    <small>{{ String(value).length }}/20</small>
  </template>

  <template #nicknameError="{ errors }">
    <small v-if="errors?.length">{{ errors.join("；") }}</small>
  </template>

  <template #nickname:prefix>
    <span>@</span>
  </template>
</Schemx>
```

### 组件 ref 暴露实例

组件通过 `defineExpose` 暴露传入或内部创建的完整 `SchemxInstance<T>`：

| 分类               | 成员                                                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 值                 | `getFieldValue`、`getFieldsValue`、`setFieldValue`、`setFieldsValue`                                                                                                                 |
| 快照与初始值       | `getFieldSnapshot`、`getFieldsSnapshot`、`getInitialValue`、`getInitialValues`、`setInitialValue`、`setInitialValues`                                                                |
| touched            | `isFieldTouched`、`isFieldsTouched`、`setFieldTouched`、`setFieldsTouched`、`getTouchedFields`                                                                                       |
| pending 与 loading | `setFieldPending`、`setFieldsPending`、`isFieldPending`、`isFieldsPending`、`getPendingFields`、`isLoading`                                                                          |
| 错误               | `getFieldErrors`、`getFieldsErrors`、`setFieldErrors`、`setFieldsErrors`、`clearFieldErrors`、`clearFieldsErrors`、`clearErrors`                                                     |
| 重置、校验与提交   | `resetField`、`resetFields`、`reset`、`validateField`、`validate`、`submit`                                                                                                          |
| 响应与 Schema      | `effect`、`batch`、`setSchemas`、`updateSchemas`、`updateSchemaConfig`、`getViewSchemas`、`subscribeViewSchemas`、`waitForDependencies`                                              |
| Registry 与规则    | `getRenderer`、`registerRenderer`、`hasRenderer`、`getPresetRule`、`registerPresetRule`、`hasPresetRule`、`setFieldRules`、`setFieldsRules`、`removeFieldRules`、`removeFieldsRules` |
| 生命周期           | `destroy`                                                                                                                                                                            |

```vue
<script setup lang="ts">
  import { ref } from "vue"

  import Schemx from "@schemx/vue"
  import type { SchemxField, SchemxInstance, Values } from "@schemx/vue"

  interface ProfileValues extends Values {
    nickname: string
  }

  const schemas: SchemxField<ProfileValues>[] = [
    {
      name: "nickname",
      label: "昵称",
      componentType: "input",
    },
  ]

  const formRef = ref<SchemxInstance<ProfileValues>>()

  async function submit() {
    await formRef.value?.submit()
  }
</script>

<template>
  <Schemx ref="formRef" :schemas="schemas" />
  <button type="button" @click="submit">提交</button>
</template>
```

### 作为 Vue 插件安装

```ts
import { createApp } from "vue"

import Schemx from "@schemx/vue"

import App from "./App.vue"

createApp(App).use(Schemx).mount("#app")
```

`app.use(Schemx)` 会注册全局组件名 `SchemxForm`，并将安装选项保存为当前 Vue App 的默认配置：

```ts
app.use(Schemx, {
  schemaConfig: { showRequiredMark: false },
  defaultRendererType: "input",
  rendererRegistry,
  presetRuleRegistry,
  validatorAdapters: [adapter],
})
```

安装配置属于当前 Vue App；不同 App 可以使用不同的 Registry、字段默认值、默认 renderer 类型和校验 adapter，适用于多应用和 SSR 隔离场景。配置优先级为表单显式配置、当前 App 安装配置、Vue 包默认 Registry、Core 模块级配置、Core 内置默认值。`validatorAdapters` 按该顺序合并，不同配置层的同 ID adapter 由高优先级配置覆盖，同一配置层内的重复 ID 仍需通过 `{ adapter, override: true }` 显式覆盖。`app.use()` 不会调用 Core 的模块级 `configureSchemx()`；该 API 仍可作为 Vue 与直接 `createForm()` 的低优先级基线。可安装组件还挂载了静态属性 `Schemx.Field`；`Group` 仅作为根入口命名导出，不是静态属性。

`SchemxFormProps` 和 Vue 层 `FieldInstance` 也会从 `@schemx/vue` 根入口导出；业务代码通常仍可直接从组件或 Hook 调用处推导类型，不需要依赖深层路径。

需要对组件树内多个表单统一设置展示默认值时，可以使用 `ConfigProvider`：

```vue
<script setup lang="ts">
  import Schemx, { ConfigProvider } from "@schemx/vue"
</script>

<template>
  <ConfigProvider :schema-config="{ readonly: true, showRequiredMark: false }">
    <Schemx :schemas="schemas" />
  </ConfigProvider>
</template>
```

`ConfigProvider` 不渲染额外 DOM；子级 Provider 的非空配置会覆盖父级同名配置。`schemaConfig` 和 `colComponent` 的变化会同步到已挂载的内部 `<Schemx>`，Registry、校验 adapter 和默认 Renderer 类型只在 Form 创建时解析。

## Schema 写法

根入口从 `@schemx/core` 传递导出 `SchemxField<T>`。它是普通字段、分组、动态依赖子树和动态数组字段的联合类型。

### 普通字段

```ts
import type { SchemxField } from "@schemx/vue"

type Values = {
  nickname: string
}

const schemas: SchemxField<Values>[] = [
  {
    name: "nickname",
    label: "昵称",
    componentType: "input",
    initialValue: "",
    placeholder: "请输入昵称",
    required: true,
    showRequiredMark: false,
    validationTrigger: ["change", "blur"],
    componentProps: {
      align: "left",
    },
  },
]
```

普通字段的真实字段如下：

| 字段                                                     | 必填 | 说明                                                                                                                                                             |
| -------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                                                   | 是   | 字段路径，支持字符串和路径数组                                                                                                                                   |
| `label`                                                  | 是   | 标签文本                                                                                                                                                         |
| `componentType`                                          | 是   | Registry 中的 Renderer key                                                                                                                                       |
| `dependencies`                                           | 否   | 基于其他字段动态覆盖展示属性的结构化依赖配置                                                                                                                     |
| `componentProps`                                         | 否   | 透传给 Renderer 的专属 Props；框架注入项会覆盖同名值                                                                                                             |
| `placeholder`                                            | 否   | 占位提示                                                                                                                                                         |
| `required`、`readonly`、`disabled`、`visible`            | 否   | 字段展示和交互状态；`required` 同时参与默认必填校验与星号默认展示                                                                                                |
| `showRequiredMark`                                       | 否   | 只控制 label 前星号：未设置时等同于 `Boolean(required)`；设为 `true` 可显示非必填字段星号，设为 `false` 可隐藏必填字段星号；禁用或只读时始终隐藏，且不会影响校验 |
| `initialValue`                                           | 否   | 字段挂载时的初始值和 `reset()` 还原值                                                                                                                            |
| `preserve`                                               | 否   | Schema 移除或字段改名时是否保留字段值和状态；默认保留，设为 `false` 时清理旧路径                                                                             |
| `rules`                                                  | 否   | 单条或多条校验规则，支持 Standard Schema 与内置规则名                                                                                                            |
| `labelIcon`、`labelAlign`、`labelPosition`、`labelWidth` | 否   | 标签展示配置                                                                                                                                                     |
| `contentAlign`、`colon`                                  | 否   | 内容对齐和冒号配置                                                                                                                                               |
| `validationTrigger`                                      | 否   | `change`、`blur` 等校验触发时机                                                                                                                                  |
| `onChange`、`onBlur`                                     | 否   | 字段值变化和失焦时由 Vue `Field` 调用；Renderer 事件说明见后文                                                                                                   |
| `class`、`style`                                         | 否   | Vue 通过声明合并增加，运行时分别应用到字段容器的 class 和内联 style，发布根声明会自动带入该 augmentation                                                         |
| `key`                                                    | 否   | 框架字段；业务方通常不要设置                                                                                                                                     |

`showRequiredMark` 是纯展示属性，不会改变 `canVerified`、校验触发时机或 `required` 规则。例如上例即使隐藏星号，`required: true` 仍会在 `validationTrigger` 指定的时机执行必填校验；反过来，仅设置 `showRequiredMark: true` 不会让字段变为必填。

### 分组

```ts
const group: SchemxField<Values> = {
  key: "basic-info",
  label: "基本信息",
  readonly: false,
  collapsible: true,
  defaultCollapsed: false,
  destroyOnCollapse: false,
  children: [
    {
      name: "nickname",
      label: "昵称",
      componentType: "input",
    },
  ],
}
```

分组字段支持 `visible`、`readonly`、`disabled` 和容器 `dependencies`。状态会递归传递给嵌套 Group、Dependency 和普通字段。它不是普通字段，没有 `name`、`componentProps` 或字段值。

折叠支持受控 `collapsed`、非受控 `defaultCollapsed`、`onCollapsedChange` 和 `destroyOnCollapse`。`destroyOnCollapse=false` 时仅隐藏 Body 并保留后代 Renderer 实例；默认值 `true` 保持原有卸载行为。折叠只影响展示，不改变字段可见性或校验状态。

### 动态依赖子树

```ts
const dependency: SchemxField<Values> = {
  to: ["nickname"],
  dependencies: {
    triggerFields: ["editable"],
    readonly: (values) => !values.editable,
  },
  renderer: async (values, form, { abortSignal }) => {
    if (!values.nickname || abortSignal.aborted) return []

    return [
      {
        name: "signature",
        label: "签名",
        componentType: "input",
      },
    ]
  },
}
```

动态依赖节点还支持 `visible`、`readonly`、`disabled` 和容器 `dependencies`。`to` 与 `renderer` 负责动态子树结构，容器 `dependencies` 独立控制整棵子树的呈现状态。隐藏 Dependency 不会暂停 renderer，恢复可见后会展示最新子树。

`renderer` 可以同步或异步返回新的 `SchemxField<T>[]`；`context.abortSignal` 用于取消已经过期的异步依赖计算。该 `AbortSignal` 属于 Core 的 Dependency renderer，和后文 `useDictionary` 的请求行为不同。

### 动态数组

Dynamic 数组字段使用必填的 `key`、数组路径 `name` 和行模板 `item`。`item` 中的普通字段和 Group 使用相对路径，Vue 会根据当前数组索引展开并递归渲染每一行；数组行增删或移动通过 Core Form 的 `setFieldValue(path, updater)` 完成。

```ts
import { useForm, type SchemxField } from "@schemx/vue"

type Member = {
  name: string
  role: "developer" | "designer"
}

type TeamValues = {
  members: Member[]
}

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
          { name: "role", label: "角色", componentType: "text" },
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

Dynamic 容器的 `visible`、`readonly`、`disabled` 和 `dependencies` 会传递到每行后代字段。行内模板可以包含普通字段、Group 和 Dependency，但不能嵌套 Dynamic；行内 Dependency 的 `to` 使用完整表单路径，`renderer` 返回的子 Schema 使用当前行相对路径。Dynamic 组件是 `Schemx` 内部实现，不是根入口的独立导出。

## Dictionary

`SchemxDictionary<TValues, TResponse, TOption>` 描述由函数加载的选项列表：`TValues` 是完整表单值类型，`TResponse` 是 `api` 的原始返回类型，`TOption` 是格式化后的选项类型。`api` 声明第三个参数时还会收到当前请求的 `AbortSignal`。

```ts
interface SchemxDictionary<
  T extends Values = Values,
  R = unknown,
  O = unknown,
> {
  api: (values: T, form: SchemxInstance<T>, signal?: AbortSignal) => R | Promise<R>
  formatter?: (res: Awaited<R>, form: SchemxInstance<T>) => O[] | Promise<O[]>
  dependsOn?: NamePath<T>[]
  shouldFetch?: (values: T) => boolean
  immediate?: boolean
  resetOnDepsChange?: boolean
  retryCount?: number
  retryInterval?: number
  onError?: (error: Error, form: SchemxInstance<T>) => void
  onSuccess?: (data: O[], form: SchemxInstance<T>) => void
  onDepsChange?: (values: T, form: SchemxInstance<T>) => void
}
```

| 字段                | 默认值              | 真实行为                                                                                           |
| ------------------- | ------------------- | -------------------------------------------------------------------------------------------------- |
| `api`               | 必填                | 接收加载开始时的完整表单快照和实例；声明第三个参数时还会收到当前请求的 `AbortSignal`；支持同步或异步返回 |
| `formatter`         | 直接使用 `api` 结果 | 在请求成功后转换结果；支持异步，返回值应为选项数组                                                     |
| `dependsOn`         | `undefined`         | 通过 `useWatchFields` 监听这些字段；变化时执行依赖回调、可选重置和重新加载                         |
| `shouldFetch`       | 总是加载            | 每次加载前判断；返回 `false` 时跳过 `api`、清空 `list` 并结束加载状态                              |
| `immediate`         | `true`              | 组件 `onMounted` 时是否自动调用一次 `loadDict()`；不影响依赖变化或手动刷新                         |
| `resetOnDepsChange` | `false`             | 依赖变化时，如果 `useDictionary` 收到目标字段路径，调用 `form.setFieldValue(fieldName, undefined)` |
| `retryCount`        | `0`                 | 失败后的额外重试次数；总尝试次数为 `retryCount + 1`                                                |
| `retryInterval`     | `1000`              | 两次尝试之间等待的毫秒数                                                                           |
| `onError`           | 无                  | 最终失败后接收规范化的 `Error` 和表单实例                                                          |
| `onSuccess`         | 无                  | `formatter` 完成、`list` 写入后接收最终数组和表单实例                                              |
| `onDepsChange`      | 无                  | 依赖变化后、`shouldFetch` 判断前调用                                                               |

当前类型没有 `data`、`list` 或 `options` 形式的静态数组字段。同步 `api` 可以表达静态来源：

```ts
const staticDictionary: SchemxDictionary<ProfileValues, Option[], Option> = {
  api: () => [
    { label: "公开", value: "public" },
    { label: "私密", value: "private" },
  ],
}
```

异步来源可以用 `R` 保留原始响应类型，并通过 `formatter` 转为选项数组：

```ts
type CityResponse = {
  data: Array<{ id: number; name: string }>
}

const cityDictionary: SchemxDictionary<
  ProfileValues,
  CityResponse,
  { label: string; value: number }
> = {
  api: async () => {
    const response = await fetch("/api/cities")
    return (await response.json()) as CityResponse
  },
  formatter: (response) =>
    response.data.map((city) => ({
      label: city.name,
      value: city.id,
    })),
}
```

依赖字段示例：

```ts
type AddressValues = {
  province?: string
  city?: string
}

const cityDictionary: SchemxDictionary<
  AddressValues,
  Array<{ id: string; name: string }>,
  { label: string; value: string }
> = {
  api: (values) => fetchCities(values.province!),
  formatter: (cities) => cities.map((city) => ({ label: city.name, value: city.id })),
  dependsOn: ["province"],
  shouldFetch: (values) => Boolean(values.province),
  resetOnDepsChange: true,
  immediate: false,
}
```

### `useDictionary`

```ts
function useDictionary<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
  TResponse = unknown,
  TOption = unknown,
>(
  options: SchemxDictionary<TValues, TResponse, TOption>,
  fieldName?: TName,
): UseDictionaryReturn<TOption>
```

`useDictionary` 必须在已经提供表单上下文的后代组件 `setup()` 中同步调用，例如 `Schemx` 的后代 Renderer。`fieldName` 只供 `resetOnDepsChange` 清空目标字段使用。通过 `WithRemoteOptions` 包装、且位于 `Field` 内的 Renderer 会自动从字段 Context 取得当前字段路径；直接调用 `useDictionary()` 或脱离 `Field` 使用 HOC 时，仍可显式传入该参数。

`UseDictionaryReturn` 的全部成员如下：

| 成员       | 类型                      | 说明                                                             |
| ---------- | ------------------------- | ---------------------------------------------------------------- |
| `list`     | `Ref<TOption[]>`          | 最终选项数组；初始值为 `[]`                                      |
| `loading`  | `Ref<boolean>`            | 通过 `shouldFetch` 后开始请求时为 `true`，成功或失败后为 `false` |
| `error`    | `Ref<Error \| undefined>` | 新请求开始时清空；最终失败时写入规范化的 `Error`                 |
| `loadDict` | `() => Promise<void>`     | 使用当前配置和当前表单值执行加载                                 |
| `refresh`  | `() => Promise<void>`     | `loadDict` 的同语义包装；不会绕过 `shouldFetch`                  |
| `mutate`   | `(data: TOption[]) => void` | 直接替换 `list`，不调用 `api`，也不修改 `loading` / `error`    |

成功路径为 `api`（含重试）→ `formatter` → 写入 `list` → `onSuccess`。`shouldFetch`、`api`、`formatter` 或 `onSuccess` 抛错时都会进入 `loadDict()` 的错误路径：抛出值经 `normalizeError` 转为 `Error`，然后写入 `error`、清空 `list`、结束 `loading` 并调用 `onError`。通常这些错误会被处理，`loadDict()` resolve；但 `onError` 本身若抛错，该异常位于 `catch` 块内，没有第二层捕获，`loadDict()` / `refresh()` 返回的 Promise 会 reject。

依赖监听中的 `onDepsChange` 在调用 `loadDict()` 之前执行，不在其 `try...catch` 内。`onDepsChange` 自身抛错时会直接从 Watch 回调抛出，并阻止本轮重置字段及重新加载；它不会更新 `useDictionary.error`，也不会调用 `onError`。

每次 `loadDict()` 都会递增请求计数并中止上一次仍在进行的请求。`api` 声明第三个参数时会收到当前请求的 `AbortSignal`；重试等待也可被中止。过期请求的成功结果、异步 `formatter` 结果和错误都不会写入当前状态；`shouldFetch` 返回 `false` 时会清空 `list` 并结束 `loading`。底层 API 是否真正停止仍取决于它是否使用 `AbortSignal`，不要把请求中止等同于业务服务端已经取消处理。

## 自定义 Renderer

Renderer 是从 Registry 取出的普通 Vue 组件。`Field` 先展开 `schema.componentProps`，再注入或覆盖以下 Props：

| Prop / listener         | 实际值与行为                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| `value`                 | 当前字段值                                                                                  |
| `onUpdate:value(value)` | 直接调用 `field.setValue(value)`；不在这里触发字段级校验                                    |
| `onChange(value)`       | 写入字段值，调用 `componentProps.onChange(value)` 和 Schema 顶层 `onChange(value)`，并按 `validationTrigger` 执行校验 |
| `onBlur()`              | 不写值，调用 `componentProps.onBlur(value)` 和 Schema 顶层 `onBlur(form)`，并按 `validationTrigger` 执行校验       |
| `readonly`              | 当前 ViewSchema 已解析的只读状态，覆盖 `componentProps.readonly`                            |
| `disabled`              | 当前 ViewSchema 已解析的禁用状态，覆盖 `componentProps.disabled`                            |
| `placeholder`           | 当前 ViewSchema 的占位文本，覆盖 `componentProps.placeholder`                               |
| `formItemProps`         | 当前完整 ViewSchema，覆盖 `componentProps.formItemProps`                                    |

其他 `componentProps`（例如 `options`、`readonlyPlaceholder`、`align` 和已经通过声明合并注册的组件专属 Props）原样透传。Vue `Field` 会自动注入当前 Core Form 实例到 `formInstance`，并用完整 ViewSchema 覆盖 `formItemProps`。

当前也不会向普通 Renderer 自动注入 `fieldName`、字段校验 `error` / `errors` 或 `loading`。Renderer 如需当前字段路径或响应式状态，可调用 `useFieldContext()`；`WithRemoteOptions` 会自动使用该 Context 的字段路径处理 `resetOnDepsChange`，但不会把内部路径透传给被包装 Renderer。详见下一节。

注意：`componentProps.onChange`、`componentProps.onBlur` 与 Schema 顶层的 `onChange`、`onBlur` 都会在 Vue `Field` 的对应回调中调用。若只希望自定义 Renderer 行为，可把回调放在 `componentProps` 内；Schema 顶层回调分别收到字段值和表单实例。

```vue
<script setup lang="ts">
  defineProps<{
    value?: string
    readonly?: boolean
    disabled?: boolean
    placeholder?: string
    formItemProps?: { name?: string | string[] }
  }>()

  const emit = defineEmits<{
    "update:value": [value: string]
    change: [value: string]
    blur: []
  }>()
</script>

<template>
  <input
    :value="value"
    :readonly="readonly"
    :disabled="disabled"
    :placeholder="placeholder"
    @input="emit('update:value', ($event.target as HTMLInputElement).value)"
    @change="emit('change', ($event.target as HTMLInputElement).value)"
    @blur="emit('blur')"
  />
</template>
```

`update:value` 和 `change` 都能写入 Store；需要 `change` 校验和 `componentProps.onChange` 回调时，应发出 `change`。`blur` 的参数会被忽略。

### 全局与表单独立 Registry

全局 Registry 会作为 `useForm()` 的默认值：

```ts
import { markRaw } from "vue"

import { rendererRegistry } from "@schemx/vue"

import InputRenderer from "./InputRenderer.vue"

rendererRegistry.register("input", markRaw(InputRenderer))
```

通过 `app.use(Schemx, options)` 提供的 Registry 只对当前 Vue App 生效，并优先于上面的 Vue 模块级 Registry；表单 Props 或 `useForm()` 传入独立 Registry 时优先级最高。

也可以使用根入口从 core 传递导出的 `createRendererRegistry` 创建表单独立 Registry，避免修改全局状态：

```vue
<script setup lang="ts">
  import { markRaw } from "vue"

  import Schemx, { createRendererRegistry } from "@schemx/vue"
  import type { SchemxField, Values } from "@schemx/vue"

  import InputRenderer from "./InputRenderer.vue"

  interface ProfileValues extends Values {
    nickname: string
  }

  const localRegistry = createRendererRegistry("input")
  localRegistry.register("input", markRaw(InputRenderer))

  const schemas: SchemxField<ProfileValues>[] = [
    {
      name: "nickname",
      label: "昵称",
      componentType: "input",
    },
  ]
</script>

<template>
  <Schemx :schemas="schemas" :renderer-registry="localRegistry" />
</template>
```

## WithRemoteOptions

`SchemxWithDictionary<A, T>` 是公开的类型工具：

```ts
type SchemxWithDictionary<A, T extends Values = Values> = A & {
  dict?: SchemxDictionary<T> | SchemxDictionary<T>["api"]
}
```

它只给原 Props 类型 `A` 增加可选的 `dict`；不会自动增加 `fieldName`、`options` 或 `loading`。

`WithRemoteOptions(WrappedComponent)` 返回一个增强组件。增强组件声明并消费：

- `dict?: SchemxDictionary | SchemxDictionary["api"]`：存在时规范化后调用 `useDictionary(dict, fieldName)`。
- `fieldName?: NamePath`：仅作为兼容回退。HOC 位于 `Field` 内时，默认从 `useFieldContext().name` 自动取得当前字段路径；显式值只用于脱离 `Field` 的独立使用。当前实现会把该未声明属性随 attrs 一并传给被包装组件。

被包装组件实际收到所有其余 attrs、规范化后的 `dict`，以及 HOC 决定的 `options` 和 `loading`；函数简写会在这里转换为 `{ api }` 对象：

- 有 `dict` 时，Dictionary 的 `list` 和 `loading` 无条件覆盖 attrs 中的静态 `options`、`loading`，即使列表仍为空。
- 没有 `dict` 时，原 attrs 的 `options`、`loading` 原样保留。
- HOC 不注入 `error`、`refresh`、`loadDict` 或 `mutate`。
- 有 `dict` 时内部会调用 `useFormContext()`，所以组件必须位于已提供表单上下文的后代树中。

下面包装一个自定义 Select Renderer，并让依赖字段变化时重置当前字段：

```vue
<!-- SelectRenderer.vue -->
<script setup lang="ts">
  type Option = { label: string; value: string }

  defineProps<{
    value?: string
    options?: Option[]
    loading?: boolean
    disabled?: boolean
  }>()

  const emit = defineEmits<{
    "update:value": [value: string]
    change: [value: string]
  }>()
</script>

<template>
  <select
    :value="value"
    :disabled="disabled || loading"
    @change="emit('change', ($event.target as HTMLSelectElement).value)"
  >
    <option v-for="option in options" :key="option.value" :value="option.value">
      {{ option.label }}
    </option>
  </select>
</template>
```

```ts
import { markRaw } from "vue"

import { rendererRegistry, WithRemoteOptions } from "@schemx/vue"
import type {
  NamePath,
  SchemxDictionary,
  SchemxField,
  SchemxWithDictionary,
  Values,
} from "@schemx/vue"

import SelectRenderer from "./SelectRenderer.vue"

type AddressValues = {
  province?: string
  city?: string
}

type Option = { label: string; value: string }
type City = { id: string; name: string }

// 可替换为真实请求；该最小实现让示例可以直接通过严格类型检查。
async function fetchCities(province: string): Promise<City[]> {
  return province ? [{ id: "guangzhou", name: "广州" }] : []
}

const cityDictionary: SchemxDictionary<AddressValues, City[]> = {
  api: (values) => fetchCities(values.province!),
  formatter: (cities) => cities.map((city) => ({ label: city.name, value: city.id })),
  dependsOn: ["province"],
  shouldFetch: (values) => Boolean(values.province),
  resetOnDepsChange: true,
}

declare module "@schemx/core" {
  interface SchemxRendererDefinition<T extends Values> {
    "remote-select": SchemxWithDictionary<
      {
        options?: Option[]
        loading?: boolean
      },
      T
    >
  }
}

const RemoteSelect = WithRemoteOptions(SelectRenderer)
rendererRegistry.register("remote-select", markRaw(RemoteSelect))

const schemas: SchemxField<AddressValues>[] = [
  {
    name: "city",
    label: "城市",
    componentType: "remote-select",
    componentProps: {
      dict: cityDictionary,
    },
  },
]
```

若只需要静态选项，不传 `dict` 即可；`options` 会作为普通 `componentProps` 透传：

```ts
componentProps: {
  options: [
    { label: "公开", value: "public" },
    { label: "私密", value: "private" },
  ],
}
```

## Composition API

| API                         | 说明                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| `useForm()`                 | 创建由当前 Vue effect scope 管理生命周期的表单实例；自动使用 Vue 包全局 Registry，但不会自动 `provide` |
| `provideFormContext()`      | 在当前组件 `setup()` 同步阶段一次向后代提供表单实例和展示配置                                          |
| `createFormContext()`       | 兼容 API：仅提供表单实例；建议改用 `provideFormContext()`                                               |
| `useFormContext()`          | 获取最近祖先提供的表单实例；缺少上下文时抛错                                                           |
| `useField()`                | 创建字段级读写、校验和状态控制器                                                                       |
| `createFieldContext()`      | 向后代提供字段控制器                                                                                   |
| `useFieldContext()`         | 获取当前字段控制器                                                                                     |
| `createFormConfigContext()` | 兼容 API：仅提供表单展示配置；建议改用 `provideFormContext()`                                          |
| `useFormConfigContext()`    | 获取上层表单展示配置                                                                                   |
| `createConfigProviderContext()` | 创建组件树级 ConfigProvider 上下文；通常由 `<ConfigProvider>` 内部调用。                            |
| `useConfigProviderContext()` | 获取当前 ConfigProvider 配置；没有 Provider 时返回 `undefined`。                                    |
| `useConfigProviderContextRef()` | 获取当前 ConfigProvider 的响应式配置引用；没有 Provider 时返回 `undefined`。                     |
| `useWatch()`                | 按单字段、多字段或全表签名监听变化                                                                     |
| `useWatchField()`           | 监听单个字段                                                                                           |
| `useWatchFields()`          | 监听多个字段                                                                                           |
| `useWatchAll()`             | 监听整张表单                                                                                           |
| `useDictionary()`           | 管理依赖字段的函数式选项来源                                                                           |
| `useStableRef()`            | 创建引用保持稳定的 `shallowRef`                                                                        |
| `useViewSchemas()`          | 把 `subscribeViewSchemas()` 桥接为 Vue `shallowRef`                                                    |
| `useFormSelector()`         | 从共享表单值 Runtime 派生只读 Vue Ref                                                                  |

`useForm()` 只负责创建和销毁实例。如需让自定义组件树中的 `useField()`、`useDictionary()` 或 `Field` 找到实例，应在 `setup()` 的同步调用栈中调用 `provideFormContext({ form, schemaConfig })`，一次提供表单实例和展示配置。`createFormContext()` 与 `createFormConfigContext()` 仍保留用于兼容旧代码。直接使用 `<Schemx>` 时，统一 Form Context 已由组件提供。

### 通用调用规则

依赖 Vue 生命周期或 provide / inject 的 Hook 应在 `setup()` 期间同步调用。直接使用 `<Schemx>` 时，组件已提供表单实例与展示配置；字段 Renderer 还会获得当前字段 Context。

### `useForm`

```ts
function useForm<TValues extends Values = Values>(
  options?: CreateFormOptions<TValues, NamePath<TValues>>
): VueSchemxInstance<TValues>
```

源码中参数类型名为 `UseFormOptions<TValues>`，结构等同上面的 `CreateFormOptions`；`UseFormOptions` 未从根入口导出。`options` 可选，未传 Registry 时使用 Vue 全局 `rendererRegistry` 和 `presetRuleRegistry`。函数同步返回 `VueSchemxInstance<TValues>`：它与 `SchemxInstance<TValues>` 结构兼容，但 `getFieldValue()`、`getFieldErrors()`、`isFieldTouched()`、`isFieldPending()`、`getFieldsValue()` 和聚合状态读取可被 Vue effect 追踪。`useForm()` 不读取 Context，也**不会自动 `provide`**；当前 Vue effect scope 销毁时会释放 Runtime 并销毁 Form。非 Vue scope 场景应改用 Core `createForm()` 并自行销毁。

```ts
import { provideFormContext, useForm } from "@schemx/vue"

type ProfileValues = { nickname: string }
const form = useForm<ProfileValues>({ initialValues: { nickname: "" } })

// 需要让后代 Hook 读取时，同时提供表单实例和展示配置。
provideFormContext({
  form,
  schemaConfig: { readonly: false, validationTrigger: "blur" },
})
```

`useForm()` 除了补全 Vue 全局 Registry 外，会把 Core options 原样传给 `createForm()`。因此直接调用时，`initialValues` 会按 Core 规则形成初始快照，`submit()` 也会等待直接传入的 `onFinish` Promise。前文 `modelValue` 的初始化与同步行为只属于 `<Schemx>` 内部创建实例时的 Props 转换，不属于 `useForm()` 本身。`defaultRendererType` 仍会受全局 Renderer Registry 已被补全的影响，见前文说明。

### Vue Instance 与共享 Runtime

同一 Core Form 始终复用一个 Instance 和一个内部 Runtime；响应式资源按需创建，并在存活期间由各个 Vue owner 共享。Instance 的写入、校验、提交、Schema 与 Registry 方法都委托原始 Core Form；仅常用状态读取会额外建立 Vue 依赖。`getFieldsValue()` 无参数时依赖全表值，传入路径时仅依赖这些字段。`getFieldSnapshot()`、`getFieldsSnapshot()`、`getInitialValue()` 与 `getInitialValues()` 保持 Core 的无依赖快照语义。

`useFormSelector()` 和 `useField()` 复用这个 Runtime；前者返回 selector 结果的只读 Ref，后者复用字段 `value`、`errors`、`touched` 和 `pending` Ref。Runtime 通过 `@schemx/core/adapter` 的 `createFormStateAdapter()` 消费 Core `SnapshotSource`。最后一个 Vue owner 释放或手动调用 `form.destroy()` 后，Runtime 会停止订阅并释放这些快照来源。

### Context API

Form、Field 和 ConfigProvider 是 3 组 Context。Form 与 Field 的 Reader 要求对应 Context 存在；ConfigProvider Reader 在没有 Provider 时返回 `undefined`。`provideFormContext()` 和 `create*Context()` 必须在 Provider 组件的 `setup()` 同步阶段调用，且只对后代可见；`use*Context()` 仅读取最近祖先提供的值。

```ts
function provideFormContext<TValues extends Values = Values>(
  options: ProvideFormContextOptions<TValues>
): VueSchemxInstance<TValues>
function useFormContextValue<TValues extends Values = Values>(): FormContextValue<TValues>
function useFormContext<TValues extends Values = Values>(): VueSchemxInstance<TValues>

function createFormContext<TValues extends Values = Values>(
  instance: SchemxInstance<TValues> | VueSchemxInstance<TValues>
): VueSchemxInstance<TValues>

function createFieldContext<TValues extends Values = Values>(
  field: FieldInstance<TValues>
): void
function useFieldContext(): FieldInstance<Values>

function createFormConfigContext(props: FormContextProps): void
function useFormConfigContext(): FormContextProps

function createConfigProviderContext(config: ComputedRef<SchemxVueConfig>): void
function useConfigProviderContext(): SchemxVueConfig | undefined
function useConfigProviderContextRef(): ComputedRef<SchemxVueConfig> | undefined
```

上面签名中的 `FieldInstance` 已从 `@schemx/vue` 根入口导出。`createFieldContext()` 当前只有 `TValues extends Values = Values`，**没有独立的 `TName` 泛型**；`field` 必须是 `useField()` 返回的 Vue 字段控制器，字段路径已由创建该返回值时的 `name` 捕获。调用方可以显式导入 `FieldInstance`，也可以依靠 `useField()` 推导参数。

| Provider 签名                                                              | Reader 签名                                             | 职责、所有权与缺失行为                                                                                                                                                 |
| -------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `provideFormContext<T>({ form, schemaConfig })`                            | `useFormContextValue<T>(): FormContextValue<T>`          | 一次提供 Vue Form Instance 和展示配置；Provider 只持有 Runtime，不销毁外部 Core Form。                                                                                |
| `provideFormContext<T>({ form, schemaConfig })`                            | `useFormContext<T>(): VueSchemxInstance<T>`              | 只读取统一 Context 中的表单实例；缺失时 Reader 抛出 `Error`。                                                                                                          |
| `createFormContext<T>(form)`（兼容）                                      | `useFormContext<T>(): VueSchemxInstance<T>`              | 仅提供表单实例的旧 API；建议迁移到 `provideFormContext()`。                                                                                                             |
| `createFieldContext<TValues extends Values = Values>(field): void`         | `useFieldContext(): FieldInstance<Values>`              | 提供 / 读取 `useField()` 返回的字段控制器。Provider 不创建字段、不接管订阅；缺失时 Reader 抛出 `Error`。                                                               |
| `createFormConfigContext(props)`（兼容）                                   | `useFormConfigContext(): FormContextProps`              | 仅提供 / 读取表单展示配置的旧 API；建议迁移到 `provideFormContext()`。                                                                                                  |

```ts
import { provideFormContext, useForm, type SchemxField } from "@schemx/vue"

type ProfileValues = { nickname: string }
const schemas: SchemxField<ProfileValues>[] = [
  { name: "nickname", label: "昵称", componentType: "input" },
]
const form = useForm<ProfileValues>({ schemas })
provideFormContext({
  form,
  schemaConfig: {
    readonly: false,
    validationTrigger: "blur",
  },
})
```

在后代组件的 `setup()` 中只读取所需 Context：

```ts
import { useFieldContext, useFormContextValue } from "@schemx/vue"

type ProfileValues = { nickname: string }
const { form, schemaConfig } = useFormContextValue<ProfileValues>()
const field = useFieldContext()
```

### `useField`

```ts
function useField<TValues extends Values = Values>(
  name: NamePath<TValues>
): FieldInstance<TValues>
```

Hook 从 `useFormContext()` 取得 Instance，为 `name` 创建 Core 字段控制器，并复用共享 Runtime 中的字段状态。它保留 Core `SchemxFieldInstance` 的全部成员，并增加 `value: Ref<FieldValue<...> | undefined>`、`errors: ComputedRef<readonly string[]>`、`dirty: ComputedRef<boolean>` 与 `pending: ComputedRef<boolean>`；`dirty` 读取字段 touched Ref。`getValue()`、`getErrors()`、`isTouched()` 和 `isPending()` 都读取对应 Vue Ref，`getValues()` 则通过 Instance 读取全表值。只有 `value` 可通过 `.value` 写入，其余三个 computed 状态只读。Core 方法的完整签名见 [Core Schema source、字段与监听](../core#schema-source字段与监听)。

`useField()` 不缓存字段控制器对象；每次调用只创建轻量的 Core 控制器包装，并复用当前 Runtime 中按字段 `SnapshotSource` 缓存的字段 Ref。Runtime 由 `useForm()`、Form Context 和 `useFormSelector()` 等 Vue owner 的引用计数持有，最后一个 owner 释放或手动销毁后停止订阅。`FieldInstance` 可从 `@schemx/vue` 根入口导入；不需要依赖深层路径。

```ts
import { createFieldContext, useField } from "@schemx/vue"

type ProfileValues = { nickname: string }
const nickname = useField<ProfileValues>("nickname")
createFieldContext(nickname)
nickname.setValue("Schemx")
await nickname.validate()
console.log(nickname.value.value, nickname.errors.value)
```

`createFieldContext(field)` 将这一返回值提供给后代并返回 `void`；`useFieldContext()` 无参数，返回最近祖先提供的同一控制器。它们不会替代表单 Context。

### `FormContextValue` 与兼容类型的边界

`FormContextValue<T>` 同时包含统一 Context 提供的 `form` 和 `schemaConfig`。旧的 `FormContextProps` 只包含嵌套的 `schemaConfig`，供 `createFormConfigContext()` 兼容使用；这两种类型都不包含 `schemas`、`initialValues`、回调、`class`、`style`、Registry 或 `defaultRendererType`。组件 Props 中的平铺 Schema 字段会在 `<Schemx>` 内部聚合为 `schemaConfig`，再传给 Form 实例和字段展示 Context。

### `useWatch`、`useWatchField`、`useWatchFields` 与 `useWatchAll`

```ts
function useWatch<T extends Values>(
  callback: WatchAllCallback<T>,
  options?: CreateWatchOptions
): () => void
function useWatch<T extends Values>(
  name: NamePath<T>,
  callback: WatchFieldCallback<T>,
  options?: CreateWatchOptions
): () => void
function useWatch<T extends Values>(
  names: NamePath<T>[],
  callback: WatchFieldsCallback<T>,
  options?: CreateWatchOptions
): () => void

function useWatchField<T extends Values = Values>(
  name: NamePath<T>,
  callback: WatchFieldCallback<T>,
  options?: CreateWatchOptions
): () => void
function useWatchFields<T extends Values>(
  names: NamePath<T>[],
  callback: WatchFieldsCallback<T>,
  options?: CreateWatchOptions
): () => void
function useWatchAll<T extends Values = Values>(
  callback: WatchAllCallback<T>,
  options?: CreateWatchOptions
): () => void
```

`useWatch` 按参数形状分发，3 个语义化函数分别对应单字段、多字段和全表重载。它们都从 `useFormContext()` 读取表单，返回可手动调用的取消函数，并在组件卸载时自动取消。`options.immediate` 和 `options.inequality` 默认均为 `false`；后者使用深比较跳过相等值。

| 模式   | callback 第 1 个参数 | callback 第 2 个参数                                                                                                  |
| ------ | -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 单字段 | 变化后的全表快照。   | `{ value, prevValue }`；`immediate` 首次的 `prevValue` 为 `undefined`。                                                |
| 多字段 | 变化后的全表快照。   | `{ changedPaths, changedValues, prevValues }`；`immediate` 时路径为全部传入路径、`prevValues` 为 `{}`。                |
| 全表   | 变化后的全表快照。   | `{ changedPaths, changedValues, prevValues }`；`immediate` 时 `changedPaths` 为 `[]`。                                  |

`useWatchAll()` 与 `useWatch(callback)` 会在 effect 中读取可追踪的全表值，因此会在字段变化时执行；`immediate: true` 还会在创建监听时同步执行 1 次。需要减少监听范围时可使用 `useWatchField()` 或 `useWatchFields()`。

```ts
import { useWatch, useWatchAll, useWatchField, useWatchFields } from "@schemx/vue"

type ProfileValues = { firstName: string; lastName: string }
useWatch<ProfileValues>("firstName", (_snapshot, { value, prevValue }) => {
  console.log(prevValue, value)
})
useWatchField<ProfileValues>(
  "firstName",
  (snapshot, { value, prevValue }) => console.log(prevValue, value, snapshot),
  { immediate: true, inequality: true }
)
const stop = useWatchFields<ProfileValues>(["firstName", "lastName"], (_snapshot, payload) => {
  console.log(payload.changedPaths, payload.changedValues)
})
useWatchAll<ProfileValues>(
  (snapshot, payload) => {
    console.log(payload.changedPaths, snapshot)
  },
  { immediate: true }
)
stop()
```

### `useDictionary` 摘要

签名为 `useDictionary<TValues, TName, TResponse, TOption>(options, fieldName?): UseDictionaryReturn<TOption>`。它通过 `useFormContext()` 取得表单，在 `onMounted` 时按 `immediate` 决定是否加载，并通过 `useWatchFields()` 自动清理依赖订阅。完整参数、返回值、竞态边界与示例见前文 [`useDictionary`](#usedictionary)，这里不重复维护第 2 份定义。

### `useStableRef`

```ts
function useStableRef<T extends Record<string, any>>(
  factory: () => T
): Readonly<ShallowRef<T>>
```

Hook 在 Vue `watchEffect` 中执行 `factory` 并追踪 Vue 依赖。只有工厂结果与当前值浅比较不等时才替换 Ref 引用。它不使用 Schemx Context，`watchEffect` 由当前 Vue scope 管理。

```ts
import { computed } from "vue"
import { useStableRef } from "@schemx/vue"

const disabled = computed(() => false)
const stableProps = useStableRef(() => ({ disabled: disabled.value }))
```

### `useViewSchemas`

```ts
function useViewSchemas<T extends Values = Values>(
  form: SchemxInstance<T>
): ShallowRef<readonly SchemxViewSchema<T>[]>
```

Hook 不读取 Context，必须显式传入表单实例。它以 `form.getViewSchemas()` 初始化 `shallowRef`，通过 `form.subscribeViewSchemas()` 更新；当前 Vue effect scope 销毁时自动 unsubscribe。

```ts
import { useForm, useViewSchemas } from "@schemx/vue"

const form = useForm({
  schemas: [{ name: "nickname", label: "昵称", componentType: "input" }],
})
const viewSchemas = useViewSchemas(form)
console.log(viewSchemas.value)
```

## Field 与 Group

### `Field`

`Field` 的必填 Prop 是 `schema`，还支持用于包装器的 `class` 和 `style`：

| Prop      | 类型                       | 说明                                                        |
| --------- | -------------------------- | ----------------------------------------------------------- |
| `schema`  | `SchemxViewFieldSchema<T>` | Core 已解析完成的字段 ViewSchema，不是原始 `SchemxField<T>` |
| `class`   | `ClassValue`               | 追加到字段外层 wrapper 的 class。                           |
| `style`   | `StyleValue`               | 追加到字段外层 wrapper 的内联 style。                      |

`Field` 只处理普通字段 ViewSchema：它创建字段控制器、提供字段上下文、查找 Renderer，并处理标签、内容、错误、校验触发和可见性。`Schemx` 会在根级 ViewSchema 循环中直接区分并渲染 `Field` 或 `Group`。

它支持与 `Schemx` 一致的动态 Slots：`{name}`、`{name}Label`、`{name}Before`、`{name}Content`、`{name}After`、`{name}Error` 和 `{name}:{slotName}`。完整 Slot Props 见 [Schemx 组件的 Slots](#slots)。

`Field` 不能脱离上下文单独工作：普通字段至少需要祖先同步提供表单实例和展示配置，通常直接放在 `<Schemx>` 内部。若自定义 adapter 直接使用它，应调用 `provideFormContext({ form, schemaConfig })`。传给它的 Schema 应来自 `form.getViewSchemas()` 或 `useViewSchemas(form)`，不要把尚未编译的 dependency Schema 直接传入。

### `Group`

`Group` 的必填 Prop 是 `schema`，还支持外层样式和递归渲染回调：

| Prop             | 类型                          | 说明                                    |
| ---------------- | ----------------------------- | --------------------------------------- |
| `schema`         | `SchemxViewGroupSchema<T>`    | 包含已解析 `children` 的分组 ViewSchema |
| `class`          | `ClassValue`                  | 追加到 Group 外层 wrapper 的 class。    |
| `style`          | `StyleValue`                  | 追加到 Group 外层 wrapper 的内联 style。 |
| `renderChildren` | `(schemas) => VNodeChild`     | 自定义子级 ViewSchema 的递归渲染方式。   |

它会把收到的全部 Slots 原样传给子级 `Field` 或嵌套 `Group`，并支持 `{groupKey}Header`、`{groupKey}Label`、`{groupKey}Content` 三个分组自身 Slot。`Header` 替换 Header 内部内容，`Label` 替换标题，`Content` 替换 Body 内的默认子字段布局；三者都接收 `schema`、`collapsed`、`collapsible`、`disabled`、`readonly` 和 `toggle`。`collapsible` 控制标题是否可点击和通过 Enter / Space 切换；`disabled` 状态禁止折叠交互，`readonly` 状态仍允许浏览和折叠。组件支持受控与非受控折叠；从受控切换为非受控时会延续最后一次受控值。`destroyOnCollapse` 控制子级是否卸载，ARIA 关联 ID 优先使用 Core Node ID，直接挂载组件时回退到 Vue 实例 ID，避免规范化后相同 key 发生冲突。

`label` 为空时不渲染标题。Vue 源码的 `types/index.ts` 通过声明合并为分组 Schema 增加 `class` 和 `style`，发布声明入口会加载该增强；运行时将二者绑定到 `.schemx-group-wrapper` 外层容器。子级字段仍要求表单实例和展示配置上下文。

`Field` 和 `Group` 是构建自定义 Vue adapter 或重排 ViewSchemas 时的底层组件。一般业务表单优先使用 `<Schemx>`；只有在需要自定义整体布局、分区或容器时才直接组合这两个组件。

`class` 和 `style` 支持多来源合并。`Schemx` 根节点使用内部 `schemx` class 与组件 Props；Field 外层容器按“内部 class → 父级传入 class/style → Schema 的 `class`/`style`”合并；Group 外层容器按同样顺序合并。class 会全部保留，style 后面的来源覆盖前面的同名属性。Field Schema 样式作用于 `.schemx-field-wrapper`，Group Schema 样式作用于 `.schemx-group-wrapper`。

## Registry

Vue 包自有 2 个模块级单例：

| 导出                 | 真实类型                              | 初始内容                                                                           | 与 `useForm()` 的关系                            |
| -------------------- | ------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------ |
| `rendererRegistry`   | `RendererRegistry<SchemxRendererKey>` | 空 Registry，默认 renderer key 预设为 `"input"`；未注册 `input` 时仍无法取得组件。 | 未传 `options.rendererRegistry` 时使用该单例。   |
| `presetRuleRegistry` | `PresetRuleRegistry`                  | 模块初始化时为空，只保存显式注册的预设规则；`required` 不会写入 Registry。         | 未传 `options.presetRuleRegistry` 时使用该单例。 |

Renderer Registry 包含 `register`、`registerAll`、`get`、`resolve`、`has`、`unregister`、`keys`、`setFallback`、`getFallback`、`clear` 和 `size`；PresetRuleRegistry 包含 `register`、`registerAll`、`get`、`resolve`、`has`、`unregister`、`keys`、`clear` 和 `size`。完整签名见 Core 的 [校验](../core#校验) 与 [Renderer Registry](../core#renderer-registry) 章节。

```ts
import { markRaw } from "vue"

import { rendererRegistry, presetRuleRegistry, type StandardSchemaV1 } from "@schemx/vue"

import InputRenderer from "./InputRenderer.vue"

rendererRegistry.register("input", markRaw(InputRenderer))

const phoneRule: StandardSchemaV1<string> = {
  "~standard": {
    version: 1,
    vendor: "app",
    validate(value) {
      return typeof value === "string" && /^1\d{10}$/.test(value)
        ? { value }
        : { issues: [{ message: "手机号格式错误" }] }
    },
  },
}
presetRuleRegistry.register("phone", phoneRule)
```

全局 Registry 由所有表单共享。表单独立 Registry 则由 Core 工厂新建，并通过 `useForm()` 选项或 `<Schemx>` Props 传入：

```ts
import { createRendererRegistry, createPresetRuleRegistry, useForm } from "@schemx/vue"

const renderers = createRendererRegistry("input")
const validators = createPresetRuleRegistry()
const form = useForm({ rendererRegistry: renderers, presetRuleRegistry: validators })
```

`createRendererRegistry()` 和 `createPresetRuleRegistry()` 是 Core 传递导出，不是 Vue 自有 API。独立 PresetRuleRegistry 创建时为空，只有调用方显式注册的预设规则；必填由字段的 `required` 配置处理。

## 类型参考

Vue 根入口自有以下公开类型：

| 类型                               | 定义与用途                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `FormContextValue<TValues>`        | 统一 Form Context，包含表单实例和展示配置。见 [Composition API](#formcontextvalue-与兼容类型的边界)。 |
| `ProvideFormContextOptions<TValues>` | `provideFormContext()` 的输入配置。                         |
| `FormContextProps`                 | 兼容 API 使用的表单展示配置类型。                            |
| `SchemxDictionary<TValues, TResponse, TOption>` | 函数式选项源配置；`TResponse` 从 `api` 传递到 `formatter`，`TOption` 是格式化后的选项类型。见 [Dictionary](#dictionary)。 |
| `SchemxInstallOptions`             | 基于 Vue `SchemxVueConfig` 的 App 安装配置，额外包含 `colComponent`；`app.use(Schemx, options)` 会保存为当前 Vue App 的默认配置。 |
| `SchemxWithDictionary<A, TValues>` | `A & { dict?: SchemxDictionary<TValues> \| SchemxDictionary<TValues>["api"] }`，只增加可选 `dict`。见 [WithRemoteOptions](#withremoteoptions)。 |
| `UseDictionaryReturn<TOption>`     | `{ list, loading, error, loadDict, refresh, mutate }`，`list` 和 `mutate` 使用 `TOption`。见 [`useDictionary`](#usedictionary)。 |
| `SchemxFormProps<TValues>`         | `Schemx` 组件 Props 类型，由 Core 表单选项和 Vue 专属 `modelValue`、`form`、`class`、`style` 等属性组合而成。       |
| `FieldInstance<TValues>`           | Vue Ref / Computed 桥接后的字段控制器类型，由 `useField()` 返回。                                                   |
| `SchemxFieldSlotProps<TValues>`    | 字段整体、Label、Before、After 插槽的公共参数。                                                                   |
| `SchemxFieldContentSlotProps<TValues>` | Content 插槽参数，额外包含默认 Renderer 的 `columnElement`。                                                      |
| `SchemxFieldErrorSlotProps<TValues>` | Error 插槽参数，额外包含当前字段的 `errors`。                                                                    |
| `SchemxFieldSlots<TValues>`        | `Field` 组件接收的动态字段插槽与 Renderer 子插槽类型。                                                           |
| `SchemxFieldSlotValue<TValues>`    | 字段区域插槽的参数联合类型。                                                                                      |
| `SchemxGroupSlotProps<TValues>`    | Group Header、Label、Content 插槽参数。                                                                            |
| `SchemxGroupSlots<TValues>`        | Group 动态插槽类型映射。                                                                                           |
| `SchemxVueBaseComponentProps`      | Vue Renderer 公共 Props。                                                                                          |
| `SchemxVueLayout`                  | Vue 24 栅格布局元数据。                                                                                            |
| `SchemxVueConfig`                  | Vue 层配置，包含 Core 配置与 `colComponent`。                                                                      |
| `SchemxFormActionConfig`、`SchemxFormAction` | 内置提交 / 重置按钮配置。                                                                                  |

除上述类型外，不要从 `@schemx/vue/src/*` 或 `@schemx/vue/dist/*` 深层导入。

## Core API

`@schemx/vue` 通过 `export * from "@schemx/core"` 传递 Core 根入口的公开导出。它们仍是 Core API，不是 Vue 自有 Composition API；具体名称与签名以 [Core README](../core) 和包根入口为准。

## 完整导出清单

根入口包含默认表单组件、Vue 适配层 API，以及 Core 根入口的传递导出。这里不固定列出导出总数，避免新增公开 API 后文档中的统计数字失效。

### Vue 自有导出

| 分类            | 导出                                | 用途                                          |
| --------------- | ----------------------------------- | --------------------------------------------- |
| 表单组件        | `schemxForm`                        | 可安装的表单组件；与 `default` 指向同一对象。 |
| 组件            | `Field`                             | 渲染字段 ViewSchema。                         |
| 组件            | `Group`                             | 渲染分组 ViewSchema。                         |
| 组件            | `Col`                               | 将布局元数据映射到已注册的 Col 组件。        |
| 组件            | `Wrapper`                           | 提供 Renderer 的只读 / 禁用状态包装。        |
| 组件            | `ConfigProvider`                    | 提供组件树级默认配置。                       |
| 布局            | `registerCol`                       | 注册 Vue 全局 Col 组件。                     |
| HOC             | `WithRemoteOptions`                 | 为 Renderer 接入 Dictionary。                 |
| Registry        | `rendererRegistry`                  | Vue 全局 Renderer Registry。                  |
| Registry        | `presetRuleRegistry`                | Vue 全局 PresetRuleRegistry。                 |
| Hook            | `useForm`                           | 创建并按 Vue scope 销毁表单。                 |
| Context         | `provideFormContext`                | 一次提供表单实例和展示配置。                  |
| Context         | `useFormContextValue`               | 读取统一 Form Context。                        |
| Context         | `useFormContext`                    | 读取表单实例。                                |
| Context         | `useFormRuntimeContext`              | 获取当前表单的共享 Vue Runtime。              |
| Context         | `createFormContext`                 | 兼容 API：仅提供表单实例。                    |
| Hook            | `useField`                          | 创建 Vue 字段控制器。                         |
| Context         | `createFieldContext`                | 提供字段控制器。                              |
| Context         | `useFieldContext`                   | 读取字段控制器。                              |
| Context         | `createFormConfigContext`           | 兼容 API：仅提供表单展示配置。                |
| Context         | `useFormConfigContext`              | 读取兼容表单展示配置。                        |
| Context         | `createConfigProviderContext`       | 创建 ConfigProvider 上下文。                  |
| Context         | `useConfigProviderContext`          | 读取 ConfigProvider 当前配置。                |
| Context         | `useConfigProviderContextRef`       | 读取 ConfigProvider 响应式配置引用。          |
| Watch           | `useWatch`                          | 统一分发 Vue Watch。                          |
| Watch           | `useWatchField`                     | 单字段 Vue Watch。                            |
| Watch           | `useWatchFields`                    | 多字段 Vue Watch。                            |
| Watch           | `useWatchAll`                       | 全表 Vue Watch。                              |
| Dictionary      | `useDictionary`                     | 管理函数式选项源。                            |
| Vue 响应式      | `useStableRef`                      | 建立浅比较稳定 Ref。                          |
| ViewSchema      | `useViewSchemas`                    | 桥接 ViewSchemas 为 Ref。                     |
| Hook            | `useFormSelector`                   | 从表单值派生只读 Vue Ref。                    |
| 默认导出        | `default`                           | 与 `schemxForm` 严格相等。                    |
| Context 类型    | `FormContextValue<TValues>`        | 统一 Form Context，包含表单实例和展示配置。   |
| Context 类型    | `ProvideFormContextOptions<TValues>` | `provideFormContext()` 的输入配置。           |
| Context 类型    | `FormContextProps`                  | 兼容 API 使用的表单展示配置类型。             |
| Runtime 类型    | `VueSchemxInstance`                 | 可在 Vue effect 中追踪读取的 Form Instance。  |
| Dictionary 类型 | `SchemxDictionary<TValues, TResponse, TOption>` | 函数式选项源配置。                       |
| 插件类型        | `SchemxInstallOptions`              | 基于 Vue `SchemxVueConfig` 且包含 `colComponent` 的 App 默认配置安装选项。 |
| Dictionary 类型 | `SchemxWithDictionary`              | 为 Props 增加 `dict`。                        |
| Dictionary 类型 | `UseDictionaryReturn<TOption>`      | `useDictionary()` 返回值。                    |
| 表单类型        | `SchemxFormProps<TValues>`          | `<Schemx>` 组件 Props 类型。                  |
| 字段类型        | `FieldInstance<TValues>`            | Vue Ref / Computed 桥接后的字段控制器类型。   |
| 插槽类型        | `SchemxFieldSlotProps`、`SchemxFieldContentSlotProps`、`SchemxFieldErrorSlotProps`、`SchemxFieldSlotValue`、`SchemxFieldSlots` | Field 插槽参数和插槽映射。 |
| 插槽类型        | `SchemxGroupSlotProps`、`SchemxGroupSlots` | Group 插槽参数和插槽映射。                 |
| 组件类型        | `SchemxFieldProps`、`SchemxGroupProps`、`ConfigProviderProps<TValues>` | Field、Group 和 ConfigProvider Props。 |
| 布局类型        | `SchemxVueBaseComponentProps`、`SchemxVueLayout`、`SchemxVueConfig`、`SchemxColComponent`、`SchemxColProps` | Vue Renderer、布局和配置类型。 |
| 按钮类型        | `SchemxFormActionConfig`、`SchemxFormAction` | 内置提交 / 重置按钮配置。                 |
| Selector 类型   | `UseFormSelectorOptions<TSelected>` | `useFormSelector` 的比较和刷新配置。          |

根入口没有名为 `SchemxForm` 的命名导出。

### Core 传递运行时值

| 分类          | 导出                          | 用途                                         |
| ------------- | ----------------------------- | -------------------------------------------- |
| 表单          | `createForm`                  | 创建 Core 表单。                             |
| 字段          | `createField`                 | 创建 Core 字段控制器。                       |
| Schema source | `createSchemas`               | 创建可更新 Schema source。                   |
| Schema source | `isSchemxSchemas`             | 判断 Schema source。                         |
| Effect        | `createSignalEffect`          | 创建 Core signal effect。                    |
| Effect        | `runSignalUntracked`          | 在不追踪 signal 依赖的上下文中执行函数。     |
| Watch         | `createSignalWatch`           | 监听 signal source 的变化。                  |
| Watch         | `createDebouncedSignalWatch`  | 监听 signal source，并提供 debounce 控制器。 |
| 配置          | `configureSchemx`             | 设置 Core 模块级默认配置。                   |
| 配置          | `getGlobalSchemxConfig`       | 读取 Core 模块级默认配置。                   |
| 配置          | `mergeConfig`                 | 按优先级纯合并配置。                         |
| 配置          | `resolveSchemxConfig`         | 补齐 `schemaConfig` 默认值。                 |
| 配置          | `mergeAndResolveSchemxConfig` | 合并配置并补齐默认值。                       |
| 配置          | `defaultSchemxConfig`         | Core 内置框架无关字段默认值；UI 展示默认值由 Vue 层提供。 |
| 配置          | `defaultSchemxConfigKeys`     | 当前默认配置 key 集合。                      |
| 配置          | `excludeSchemxConfigKeys`     | 不参与字段默认配置的 key。                   |
| Watch         | `createWatch`                 | 分发 Core Watch。                            |
| Watch         | `createWatchField`            | 单字段 Core Watch。                          |
| Watch         | `createWatchFields`           | 多字段 Core Watch。                          |
| Watch         | `createWatchAll`              | 全表 Core Watch。                            |
| Registry      | `createRendererRegistry`      | 创建 Renderer Registry。                     |
| Registry      | `createPresetRuleRegistry`    | 创建 PresetRuleRegistry。                    |
| Schema 守卫   | `isFieldSchema`               | 判断原始普通字段。                           |
| Schema 守卫   | `isGroupSchema`               | 判断原始 Group。                             |
| Schema 守卫   | `isDependencySchema`          | 判断原始 Dependency。                        |
| Schema 守卫   | `isDynamicSchema`              | 判断原始 Dynamic 数组字段。                   |
| ViewSchema 守卫 | `isSchemxViewFieldSchema`、`isViewGroupSchema`、`isViewDynamicSchema` | 判断 ViewSchema 分支。 |
| 路径          | `getByPath`                   | 读取嵌套路径。                               |
| 路径          | `setByPath`                   | 写入嵌套路径。                               |
| 路径          | `collectObjectPathsByLeaf`    | 收集叶子路径。                               |

### Core 传递类型

| 分类               | 导出                            | 用途                                      |
| ------------------ | ------------------------------- | ----------------------------------------- |
| Effect             | `SignalEffectOptions`           | signal effect 配置。                      |
| Effect             | `SignalEffectDispose`           | signal effect 的 dispose 函数类型。       |
| Watch              | `SignalWatchOptions`            | signal watch 配置。                       |
| Watch              | `DebouncedSignalWatchOptions`   | 带 debounce 的 signal watch 配置。        |
| Watch              | `DebouncedSignalWatchControls`  | 带 debounce 的 signal watch 控制器。      |
| Watch              | `CreateWatchOptions`            | Watch 选项。                              |
| Watch              | `CreateWatchReturn`             | Watch 取消函数。                          |
| Watch              | `WatchFieldCallback`            | 单字段 Watch callback。                   |
| Watch              | `WatchFieldsCallback`           | 多字段 Watch callback。                   |
| Watch              | `WatchAllCallback`              | 全表 Watch callback。                     |
| 表单               | `CreateFormOptions`             | Core 表单创建选项。                       |
| 表单               | `FormSchemaOptions`             | Schema、初始值和 `schemaConfig` 配置。    |
| 表单               | `FormRegistryOptions`           | Renderer、Rule Registry 和 adapter 配置。 |
| 表单               | `FormCallbackOptions`           | 提交、值变化和规则错误回调。              |
| 表单               | `FormLifecycleOptions`          | Runtime 生命周期钩子。                    |
| 表单               | `FormPerformanceOptions`        | Scheduler 与整表校验并发配置。            |
| 表单               | `ResolvedCreateFormOptions`     | 已归一化的 Form 创建配置。                |
| 表单               | `SchemxInstance`                | Core 表单实例接口。                       |
| 基础               | `Values`                        | 表单值基础约束。                          |
| 基础               | `Dynamic`                       | 静态值或同步 / 异步值函数。               |
| 路径               | `NamePath`                      | 类型安全字段路径。                        |
| 路径               | `FieldValue`                    | 从路径提取字段值。                        |
| 值更新             | `SetValueAction`、`SetValuesAction` | `setFieldValue()` / `setFieldsValue()` 的值或 updater 类型。 |
| 工具类型           | `DeepReadonly`                  | 深层只读类型。                            |
| 工具类型           | `CSSProperties`                 | CSS 属性类型。                            |
| Schema source      | `SchemxSchemas`                 | 可更新 Schema source。                    |
| Schema source      | `SchemxSchemasInput`            | Schema 数组或 source 联合。               |
| Schema source      | `SchemxSchemasListener`         | Schema source listener。                  |
| 字段               | `SchemxFieldInstance`           | Core 字段控制器。                         |
| 字段数组           | `FieldArrayItemValue`           | 数组字段行值类型。                        |
| 字段数组           | `FieldArrayPath`                | 数组字段路径类型。                        |
| 字段数组           | `FieldArrayChange`              | 数组结构变化的变更描述。                  |
| 表单               | `SchemxFormApi`                 | 传递给动态 Schema 回调的表单 API。        |
| 表单               | `SchemxFieldRulesMap`           | 按字段路径配置的规则映射。                |
| Schema             | `SchemxBase`                    | 普通字段基础接口。                        |
| Schema             | `SchemxBaseField`               | 按 Renderer key 分布的字段联合。          |
| Schema             | `SchemxExactBaseField`          | 保留具体 Renderer key 的字段类型。        |
| Schema             | `SchemxGroupField`              | 原始 Group Schema。                       |
| Schema             | `SchemxDependencyField`         | 原始 Dependency Schema。                  |
| Schema             | `SchemxField`                   | 全部原始 Schema 联合。                    |
| Schema             | `SchemxDynamicField`、`SchemxDynamicArrayPath`、`SchemxDynamicNamePath` | Dynamic 数组 Schema 与路径类型。 |
| Schema             | `SchemxDynamicItemSchema`、`SchemxDynamicItemGroup`、`SchemxDynamicItemDependency`、`SchemxDynamicItemDependencyRendererContext` | Dynamic 行模板类型。 |
| Schema             | `SchemxBaseComponentProps`      | Core Renderer 公共 Props。                |
| Schema             | `SchemxCoreBaseComponentProps`、`SchemxRendererPropsMap` | Core 公共 Props 与默认 Props 映射。 |
| Schema             | `SchemxFormItemProps`           | Field 展示 Props。                        |
| Schema             | `SchemxLayout`                  | Core 保留的布局元数据类型。               |
| Schema             | `SchemxVueBaseComponentProps`   | Vue Renderer 公共 Props。                 |
| Schema             | `SchemxComponentProps`          | Renderer 专属与公共 Props。               |
| 扩展               | `SchemxComponentPropsDefinition` | Renderer 公共 Props 的声明合并扩展点。     |
| 扩展               | `SchemxFieldDefinition`         | 普通字段声明合并接口。                    |
| 扩展               | `SchemxGroupFieldDefinition`    | Group 声明合并接口。                      |
| 依赖               | `SchemxFieldDependencies`       | 普通字段的动态属性与触发字段配置。        |
| 依赖               | `SchemxFieldDependenciesDefinition` | 字段依赖配置的适配层声明合并扩展点。       |
| 依赖               | `SchemxGroupDependencies`       | Group 容器的动态状态配置。                |
| 依赖               | `SchemxDependencyDependencies`  | Dependency 容器的动态状态配置。           |
| 依赖               | `SchemxContainerDependencies`   | Group/Dependency 容器动态状态配置。       |
| 依赖               | `SchemxConditionFn`             | 动态属性条件函数。                        |
| 依赖               | `SchemxDynamicDependencies`     | Dynamic 容器动态状态配置。                |
| 依赖               | `SchemxFieldDependenciesConditionKey`、`SchemxFieldDependenciesStaticProps` | 字段依赖属性的键和值类型。 |
| ViewSchema         | `SchemxViewDebugMeta`           | ViewSchema 诊断元数据。                   |
| ViewSchema         | `SchemxViewFieldSchema`         | 字段渲染投影。                            |
| ViewSchema         | `SchemxViewGroupSchema`         | Group 渲染投影。                          |
| ViewSchema         | `SchemxViewDynamicItem`、`SchemxViewDynamicSchema` | Dynamic 数组行及容器渲染投影。            |
| ViewSchema         | `SchemxViewSchema`              | 字段 / Group 投影联合。                   |
| 配置               | `MergedSchemxConfig`            | 已合并且补齐 `schemaConfig` 默认值。      |
| 配置               | `SchemxConfig`                  | Core 模块级和 Form/App 可继承配置。       |
| 配置               | `SchemxSchemaConfig`            | 表单级字段默认展示与校验配置。            |
| 配置               | `SchemxSchemaConfigDefinition`  | 表单级 Schema 配置的适配层声明合并扩展点。 |
| 配置               | `SchemxConfigKey`               | 当前默认配置 key 类型。                   |
| 配置               | `ExcludeSchemxConfigKeys`       | 排除配置 key 类型。                       |
| Renderer           | `SchemxRendererKey`             | Renderer key 类型。                       |
| Renderer           | `SchemxRendererDefinition`      | Renderer Props 声明合并接口。             |
| Renderer Registry  | `RendererRegistry`              | Renderer Registry 实例类型。              |
| Renderer Registry  | `RegistryOptions`               | 注册覆盖选项（renderer 与 rule 共享）。   |
| Renderer Registry  | `RendererMap`                   | Renderer 批量映射。                       |
| Validator          | `ValidationRule`                | 原生规则接口。                            |
| Validator          | `ValidationRuleContext`         | 原生规则执行上下文。                      |
| Validator          | `ValidationRuleIssue`           | 单条规则产生的问题。                      |
| Validator          | `ValidationRuleResult`          | 单条规则执行结果。                        |
| Validator          | `ValidationResult`              | 校验成功 / 失败联合。                     |
| Validator          | `ValidationSuccess`             | 校验成功结果。                            |
| Validator          | `ValidationFailure`             | 普通校验失败结果。                        |
| Validator          | `ValidationCancelled`           | 被更新校验或销毁操作中止的结果。          |
| Validator          | `ValidationError`               | 校验失败详情。                            |
| Validator          | `FieldValidationError`          | 单字段错误。                              |
| Validator          | `FormValidationError`           | 表单级错误。                              |
| Validator          | `AdapterRule`                   | 第三方 adapter 创建的品牌规则。           |
| Validator          | `ValidationAdapterRule`         | adapter 接收的第三方规则输入类型。        |
| Validator          | `ValidationAdapterID`           | adapter 的唯一标识类型。                  |
| Validator          | `ValidationAdapterV1`           | 第三方校验 adapter 协议。                 |
| Validator          | `ValidationAdapter`             | `ValidationAdapterV1` 的兼容别名。        |
| Validator          | `ValidationAdapterRegistration` | adapter 注册及覆盖选项。                  |
| Validator          | `ValidationAdapterOption`       | adapter 或带覆盖选项的注册项。            |
| Validator          | `ValidationTrigger`             | 校验触发时机。                            |
| Validator          | `StandardSchemaV1`              | Standard Schema v1 协议。                 |
| Validator          | `AsyncValidatorRule`            | async-validator 单条规则。                |
| Validator          | `AsyncValidatorDescriptor`      | async-validator 单条或多条规则描述。      |
| Rule               | `PresetRuleDefinition`          | 自定义规则声明合并接口。                  |
| Rule               | `PresetRuleName`                | 声明合并推导的规则 key。                  |
| Rule               | `RequiredOptions`               | 必填消息与空值判断配置。                  |
| Rule               | `RequiredConfig`                | 布尔必填开关或必填配置对象。              |
| Rule               | `DefinedFieldValue`             | 从表单值和路径提取已定义字段值。          |
| Rule               | `FieldRule`                     | 单个字段规则联合类型。                    |
| Rule               | `FieldRules`                    | Standard Schema、内置或自定义规则。       |
| Validator Registry | `PresetRuleRegistry`            | PresetRuleRegistry 实例类型。             |
| Validator Registry | `PresetRuleFactoryContext`      | 规则工厂接收的字段上下文。                |
| Validator Registry | `PresetRuleFactory`             | 按字段 Schema 生成规则的工厂。            |
| Validator Registry | `PresetRuleEntry`               | Standard Schema、原生规则或工厂联合。     |
| Validator Registry | `PresetRuleMap`                 | 规则名到条目的批量映射。                  |
| Validator Registry | `PresetRuleRegistryChange`      | Registry 变更事件。                       |
| Validator Registry | `PresetRuleRegistryListener`    | Registry 变更监听器。                     |
