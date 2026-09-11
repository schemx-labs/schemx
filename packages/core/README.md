# @schemx/core

`@schemx/core` 是框架无关的 Schema 表单运行时，负责表单状态、校验、动态 Schema、依赖计算与渲染投影。它不提供 UI；Vue 项目可配合 `@schemx/vue` 或 `@schemx/vant` 使用。

## 安装

```bash
pnpm add @schemx/core
```

## 快速开始

```ts
import { createForm, type SchemxField } from "@schemx/core"

type LoginValues = {
  email: string
  password: string
}

const schemas: SchemxField<LoginValues>[] = [
  {
    name: "email",
    label: "邮箱",
    componentType: "input",
    required: true,
  },
  {
    name: "password",
    label: "密码",
    componentType: "password",
    rules: [
      {
        validate: (value) =>
          typeof value === "string" && value.length >= 8
            ? { valid: true }
            : { valid: false, issues: [{ message: "密码至少为 8 位" }] },
      },
    ],
  },
]

const form = createForm<LoginValues>({
  initialValues: { email: "", password: "" },
  schemas,
})

form.setFieldValue("email", "hello@example.com")

const result = await form.submit()

if (result.valid) {
  console.log(result.values)
} else {
  console.log(result.errors)
}

form.destroy()
```

## `createForm(options)`

创建稳定的 `SchemxInstance`。常用选项如下；完整类型见 `CreateFormOptions<TValues>`。

| 选项                                                   | 说明                                                                                                |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `schemas`                                              | 字段数组，或 `createSchemas()` 创建的可更新 Schema source。                                         |
| `initialValues`                                        | 初始值，也是 `reset()` 的还原基准。                                                                 |
| `schemaConfig`                                         | 框架无关的字段默认值，如 `required`、`readonly`、`disabled`、`visible` 和校验触发方式；UI 适配层可通过 `SchemxSchemaConfigDefinition` 扩展。 |
| `fieldRules`                                           | 按字段路径配置的字段规则兜底；字段自身 `rules` 或动态规则优先。                                     |
| `rendererProps` / `rendererRegistry`                   | 按 `componentType` 配置默认 Props，或提供 Renderer Registry。Core 仅保存和解析 Renderer，不渲染它。 |
| `presetRuleRegistry` / `validatorAdapters`             | 预设规则注册表和额外的第三方校验 adapter；async-validator 规则由 Core 内置支持。                    |
| `onRuleError`                                          | 规则解析或执行异常时的回调。                                                                        |
| `onFinish` / `onFinishFailed`                          | `submit()` 成功或失败后的回调。                                                                     |
| `onReset` / `onLoadingChange`                          | 重置完成、提交状态变化后的回调。                                                                    |
| `onValuesChange` / `onFieldsChange`                    | 值或字段状态变化后的回调。                                                                          |
| `lifecycleHooks`                                       | Runtime 生命周期钩子。                                                                              |
| `debug` / `schedulerOptions` / `validationConcurrency` | 分别控制 Runtime 诊断、任务调度和整表校验并发数。                                                   |

## Schema

`SchemxField<TValues>` 有 3 种结构：普通字段、分组字段和动态依赖字段。

### 普通字段

普通字段必须包含 `name`、`label` 和 `componentType`，用于渲染一个具体控件。

```ts
const nickname: SchemxField = {
  name: "nickname",
  label: "昵称",
  componentType: "input",
  placeholder: "请输入昵称",
  disabled: false,
}
```

普通字段专有参数：

| 参数                                                                              | 说明                                               |
| --------------------------------------------------------------------------------- | -------------------------------------------------- |
| `name`                                                                            | 字段路径，支持如 `profile.city` 的嵌套路径。       |
| `label`                                                                           | 字段标签；传入空字符串可隐藏标签内容。             |
| `componentType`                                                                   | Renderer key，用于从 `RendererRegistry` 查找控件。 |
| `componentProps`                                                                  | 透传给目标 Renderer 的专属 Props。                 |
| `placeholder` / `readonlyPlaceholder`                                             | 普通或只读状态的占位提示。                         |
| `initialValue`                                                                    | 字段挂载时写入的初始值，也是 `reset()` 的还原值。  |
| `required` / `showRequiredMark`                                                   | 必填校验配置与必填标记展示配置。                   |
| `rules` / `validationTrigger`                                                     | 校验规则及其触发时机。                             |
| `labelIcon`、`labelAlign`、`labelPosition`、`labelWidth`、`contentAlign`、`colon` | 标签和内容区域的展示配置。                         |
| `onChange` / `onBlur`                                                             | 值变化或失焦时的字段回调。                         |
| `visible` / `readonly` / `disabled` / `dependencies`                              | 字段状态及基于其他字段值的动态覆盖规则。           |

### 分组字段

分组字段通过 `label` 和 `children` 组织固定子树，可统一控制子字段的 `visible`、`readonly` 和 `disabled` 状态。

```ts
const profileGroup: SchemxField = {
  label: "个人资料",
  children: [
    {
      name: "profile.city",
      label: "城市",
      componentType: "input",
    },
  ],
  collapsible: true,
  defaultCollapsed: true,
  destroyOnCollapse: false,
}
```

分组字段专有参数：

| 参数                                | 说明                                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| `label`                             | 分组标题。                                                                                |
| `children`                          | 固定的子 Schema 数组。                                                                    |
| `visible` / `readonly` / `disabled` | 容器状态；只读和禁用会强制作用于全部后代字段。隐藏时后代停止校验，但保留字段值。          |
| `dependencies`                      | 基于表单值动态覆盖分组容器状态。                                                          |
| `collapsible`                       | 是否允许用户切换收起与展开状态。                                                          |
| `defaultCollapsed`                  | 非受控模式下的初始状态；`true` 为初始收起，`false` 为初始展开。                           |
| `collapsed`                         | 受控收起状态；`true` 为收起，`false` 为展开。设置后由调用方负责更新该值。                 |
| `onCollapsedChange`                 | 用户切换状态时的回调，参数为最新的 `collapsed` 值。                                       |
| `destroyOnCollapse`                 | 收起时是否卸载子字段的 Renderer；默认 `true`。设为 `false` 可保留子 Renderer 的本地状态。 |

```ts
const controlledGroup: SchemxField = {
  label: "高级选项",
  children: [],
  collapsible: true,
  collapsed: false,
  onCollapsedChange(collapsed) {
    console.log(collapsed ? "已收起" : "已展开")
  },
}
```

### 动态依赖字段

动态依赖字段通过 `to` 监听字段路径，并由 `renderer` 根据最新表单值返回一组 Schema。`renderer` 也可以是异步函数。

```ts
type AccountValues = {
  accountType: "personal" | "enterprise"
  companyName?: string
}

const accountFields: SchemxField<AccountValues> = {
  to: ["accountType"],
  renderer(values) {
    if (values.accountType !== "enterprise") return []

    return [
      {
        name: "companyName",
        label: "企业名称",
        componentType: "input",
        required: true,
      },
    ]
  },
}
```

动态依赖字段专有参数：

| 参数                                | 说明                                                                          |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| `to`                                | 要监听的字段路径数组；这些字段变化时会重新执行 `renderer`。                   |
| `renderer`                          | 接收 `(values, form, context)` 并返回 Schema 数组的函数；支持返回 `Promise`。 |
| `visible` / `readonly` / `disabled` | 动态子树的容器状态；隐藏不停止 `renderer` 对 `to` 的响应。                    |
| `dependencies`                      | 基于表单值动态覆盖动态子树的容器状态。                                        |

## 表单实例 API

`createForm()` 返回的 `SchemxInstance` 按以下类别提供 API。

| 类别             | API                                                                                                                                | 用途                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 值               | `getFieldValue`、`getFieldsValue`、`setFieldValue`、`setFieldsValue`                                                               | 读取或更新当前字段值；数组同样通过 `setFieldValue` 的 updater 更新。读取会参与响应式追踪。 |
| 快照与初始值     | `getFieldSnapshot`、`getFieldsSnapshot`、`getInitialValue`、`getInitialValues`、`setInitialValue`、`setInitialValues`              | 获取非追踪快照，或维护重置基准。                                                           |
| touched          | `isFieldTouched`、`isFieldsTouched`、`setFieldTouched`、`setFieldsTouched`、`getTouchedFields`                                     | 管理字段交互状态。                                                                         |
| pending          | `isFieldPending`、`isFieldsPending`、`setFieldPending`、`setFieldsPending`、`getPendingFields`                                     | 管理字段异步操作状态与提示。                                                               |
| 错误             | `getFieldErrors`、`getFieldsErrors`、`setFieldErrors`、`setFieldsErrors`、`clearFieldErrors`、`clearFieldsErrors`、`clearErrors`   | 读取、替换或清除校验错误。                                                                 |
| 校验与提交       | `validateField`、`validate`、`submit`、`isLoading`                                                                                 | 校验字段/表单或提交表单；结果为 `ValidationResult`。                                       |
| 重置             | `resetField`、`resetFields`、`reset`                                                                                               | 恢复字段或整个表单的初始状态。                                                             |
| Schema           | `setSchemas`、`updateSchemas`、`updateSchemaConfig`                                                                                | 替换或增量更新运行中的 Schema 与默认配置。                                                 |
| 视图投影         | `getViewSchemas`、`subscribeViewSchemas`、`waitForDependencies`                                                                    | 获取可供 UI 渲染的 `SchemxViewSchema`，订阅其变化，或等待依赖计算完成。                    |
| Renderer         | `getRenderer`、`registerRenderer`、`hasRenderer`                                                                                   | 查询、注册和判断 Renderer。                                                                |
| 预设规则         | `getPresetRule`、`registerPresetRule`、`hasPresetRule`、`setFieldRules`、`setFieldsRules`、`removeFieldRules`、`removeFieldsRules` | 管理预设规则与字段规则。                                                                   |
| 响应式与生命周期 | `effect`、`batch`、`destroy`                                                                                                       | 建立响应式副作用、批量更新，或释放整个表单。                                               |

```ts
form.batch(() => {
  form.setFieldValue("email", "new@example.com")
  form.setFieldTouched("email", true)
})

const stop = form.effect(() => {
  console.log(form.getFieldValue("email"))
})

stop()
```

## 校验

原生 `ValidationRule` 的 `validate` 返回 `{ valid: true }` 或 `{ valid: false, issues }`。`ValidationResult` 使用 `valid` 作为判别字段：成功时包含 `values`，失败时包含字段或表单错误。

```ts
import { createPresetRuleRegistry, type ValidationRule } from "@schemx/core"

const emailRule: ValidationRule<string> = {
  validate(value) {
    return value?.includes("@")
      ? { valid: true }
      : { valid: false, issues: [{ message: "邮箱格式错误" }] }
  },
}

const rules = createPresetRuleRegistry()
rules.register("email", emailRule)

const form = createForm({
  presetRuleRegistry: rules,
  schemas: [{ name: "email", label: "邮箱", componentType: "input", rules: ["email"] }],
})
```

Core 内置 async-validator descriptor 支持，无需安装额外适配包，也无需在 `validatorAdapters` 中注册。可直接使用 `type`、`required`、`pattern`、`min`、`max`、`len`、`enum`、`fields`、`defaultField`、`validator` 和 `asyncValidator` 等配置：

```ts
const form = createForm({
  initialValues: { email: "invalid" },
  schemas: [
    {
      name: "email",
      label: "邮箱",
      componentType: "input",
      rules: [{ type: "email", message: "邮箱格式错误" }],
    },
  ],
})
```

`validatorAdapters` 仅用于接入其他第三方校验器或业务自定义规则。显式注册的 adapter 会优先于 Core 内置的 async-validator 规则。

`PresetRuleRegistry` 提供 `register`、`registerAll`、`get`、`resolve`、`has`、`unregister`、`keys`、`clear`、`size` 与 `subscribe`。规则也可以是接收 `{ name, label, required }` 的 `PresetRuleFactory`。

实例级 `fieldRules` 用于按字段路径设置规则兜底；字段自身 `rules` 或动态规则存在时优先。它的 value 可以是命名 preset、原生 rule、Standard Schema、adapter descriptor，也可以是单条或数组。

## Renderer Registry

`createRendererRegistry(fallbackType?)` 创建 Renderer 的注册和查询容器。它不依赖 UI 框架，Renderer 的具体类型由接入层决定。

```ts
const renderers = createRendererRegistry("text")

renderers.register("text", TextInput)
renderers.register("select", SelectInput)

const form = createForm({
  rendererRegistry: renderers,
  schemas: [{ name: "name", label: "名称", componentType: "text" }],
})
```

Registry 提供 `register`、`registerAll`、`get`、`resolve`、`has`、`unregister`、`keys`、`clear`、`setFallback` 与 `getFallback`。`resolve()` 在找不到目标 Renderer 时尝试回退类型。

## Schema source、字段与监听

| API                       | 用途                                 | 最小用法                                                                             |
| ------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------ |
| `createSchemas(initial?)` | 创建可订阅、可更新的 Schema source。 | `const schemas = createSchemas([{ name: "x", label: "X", componentType: "input" }])` |
| `isSchemxSchemas(value)`  | 判断值是否为 Schema source。         | `if (isSchemxSchemas(schemas)) {}`                                                   |
| `createField(form, name)` | 从 Form 派生单字段控制器。           | `const field = createField(form, "email"); field.setValue("a@b.com")`                |
| `createWatchField`        | 监听单一字段。                       | `createWatchField(form, "email", callback, { immediate: true })`                     |
| `createWatchFields`       | 监听多个字段。                       | `createWatchFields(form, ["firstName", "lastName"], callback, {})`                   |
| `createWatchAll`          | 监听所有字段变更。                   | `createWatchAll(form, callback, {})`                                                 |
| `createWatch`             | 根据参数自动选择上述监听模式。       | `createWatch(form, "email", callback)`                                               |

`createField()` 返回的 `SchemxFieldInstance` 包含字段值、初始值、错误、规则、touched、pending、重置、校验和 `effect` 等单字段 API。所有 watch API 都返回取消监听函数；回调接收最新表单快照与变更 payload。

## 全局配置与响应式工具

| API                                                                       | 说明                                                                                     |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `configureSchemx(config)`                                                 | 设置后续 `createForm()` 的模块级默认配置；采用替换语义。SSR 或多应用场景应使用实例配置。 |
| `getGlobalSchemxConfig()`                                                 | 获取当前模块级配置。                                                                     |
| `mergeSchemxConfig`、`resolveSchemxConfig`、`mergeAndResolveSchemxConfig` | 供适配层合并、解析配置。                                                                 |
| `defaultSchemxConfig`、`defaultSchemxConfigKeys`、`excludeSchemxConfigKeys` | Core 内置默认配置及其键列表；`excludeSchemxConfigKeys` 用于识别不属于 Schema 配置的选项。 |
| `createSignalEffect(fn)`                                                  | 创建底层响应式副作用，返回清理函数。                                                     |
| `runSignalUntracked(fn)`                                                  | 在不收集依赖的上下文执行函数。                                                           |
| `createSignalWatch`、`createDebouncedSignalWatch`                         | 监听底层 Signal；后者提供防抖控制。                                                      |

通常优先使用 `form.effect()`、`form.batch()` 与 `createWatch*()`；只有编写框架适配层或底层扩展时才需要直接使用响应式工具。

## 工具、类型与适配层入口

| 类别            | 导出                                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema 判断     | `isFieldSchema`、`isGroupSchema`、`isDependencySchema`                                                                                                                    |
| ViewSchema 判断 | `isSchemxViewFieldSchema`、`isViewGroupSchema`                                                                                                                            |
| 路径工具        | `getByPath`、`setByPath`、`collectObjectPathsByLeaf`                                                                                                                      |
| 核心类型        | `Values`、`NamePath`、`FieldValue`、`SchemxField`、`SchemxViewSchema`、`SchemxInstance`、`SchemxFormApi`、`SchemxSchemaConfig`、`SchemxSchemaConfigDefinition`、`SchemxFieldRulesMap`、`SchemxSchemaValues`、`SchemxValuesHint`、`StandardSchemaV1` |
| 适配层扩展类型  | `SchemxBaseComponentProps`、`SchemxComponentPropsDefinition`、`SchemxComponentProps`、`SchemxFormItemProps`、`SchemxFieldDependenciesDefinition`（Renderer Props、字段展示配置和动态依赖的声明合并扩展点） |
| 校验类型        | `ValidationRule`、`ValidationResult`、`ValidationError`、`AsyncValidatorRule`、`AsyncValidatorDescriptor`、`ValidationAdapter`、`ValidationAdapterOption`              |
| `/adapter` 入口 | `createRendererRegistry`、`createFormStateAdapter` 及表单状态快照相关类型，供 UI 适配层使用。                                                                             |

所有公开 API 均从 `@schemx/core` 导入；UI 适配层专用能力从 `@schemx/core/adapter` 导入。
