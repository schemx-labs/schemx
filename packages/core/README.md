# @schemx/core

框架无关的 Schema 驱动表单核心。它只处理表单状态、字段依赖、校验、运行时 schema node 和可渲染 ViewSchemas，不绑定任何 UI 框架。

`@schemx/core` 适合用来构建 Vue、React、小程序、低代码表单、动态问卷、配置化后台表单等上层适配器。

## 为什么使用

- **Headless core**：核心不渲染 DOM，只暴露状态、校验、schema node 和 renderer/rule registry。
- **Schema driven**：用 `schemas` 描述字段、分组、动态依赖和渲染器类型。
- **细粒度响应式**：字段级依赖追踪，`effect` / `watch` 只响应实际读取的字段。
- **Standard Schema 校验**：可直接接入 Zod、Valibot、ArkType 等实现 Standard Schema 的验证库。
- **动态表单优先**：支持字段动态属性、动态子树、异步 dependency renderer 和依赖完成等待。
- **TypeScript 优先**：字段路径、schema、renderer props 和表单值类型可逐步收窄。
- **适配器友好**：通过 `getViewSchemas()` / `subscribeViewSchemas()` 给 UI 层消费稳定的渲染投影。

## 安装

```bash
pnpm add @schemx/core
```

```bash
npm install @schemx/core
```

```bash
yarn add @schemx/core
```

如果需要使用 Zod、Valibot、ArkType 等校验库，请在业务项目中额外安装对应依赖。

## 快速开始

```ts
import { createForm } from "@schemx/core"
import { z } from "zod"

type LoginValues = {
  email: string
  password: string
}

const form = createForm<LoginValues>({
  initialValues: {
    email: "",
    password: "",
  },
  onFinish(values) {
    console.log("submit:", values)
  },
  onFinishFailed(error) {
    console.log("errors:", error.errors)
  },
})

form.registerRules("email", z.string().email("请输入正确的邮箱"))
form.registerRules("password", z.string().min(6, "密码至少 6 位"))

form.setFieldValue("email", "hello@example.com")
form.setFieldValue("password", "123456")

await form.submit()

form.destroy()
```

## Schema 配置

`schemas` 是 core 与框架适配层之间最重要的协议。core 会把原始 schema 编译为运行时 node，并输出适合 UI 层渲染的 ViewSchemas。

```ts
import { createForm, createSchemas } from "@schemx/core"

type UserValues = {
  name: string
  email: string
}

const form = createForm<UserValues>({
  initialValues: {
    name: "",
    email: "",
  },
  schemas: createSchemas<UserValues>([
    {
      name: "name",
      label: "姓名",
      componentType: "input",
      rules: "required",
      placeholder: "请输入姓名",
    },
    {
      name: "email",
      label: "邮箱",
      componentType: "input",
      rules: ["required"],
      placeholder: "请输入邮箱",
    },
  ]),
})

const viewSchemas = form.getViewSchemas()
```

### 分组

```ts
const form = createForm({
  schemas: [
    {
      componentType: "group",
      label: "基础信息",
      children: [
        { name: "name", label: "姓名", componentType: "input" },
        { name: "phone", label: "手机号", componentType: "input" },
      ],
    },
  ],
})
```

### 动态字段属性

字段的 `dependencies` 用于动态计算 `visible`、`disabled`、`readonly`、`required`、`rules`、`placeholder` 和 `componentProps`。

```ts
const form = createForm({
  initialValues: {
    accountType: "personal",
    companyName: "",
  },
  schemas: [
    {
      name: "accountType",
      label: "账号类型",
      componentType: "select",
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
        rules: (values) => (values.accountType === "company" ? ["required"] : undefined),
      },
    },
  ],
})
```

### 动态子树

`componentType: "dependency"` 可以根据字段值返回一段新的 schema。renderer 支持同步或异步，适合条件字段、远程配置和多步骤表单。

```ts
import { createForm, createSchemas } from "@schemx/core"

type SurveyValues = {
  mode: "simple" | "advanced"
  detail?: string
}

const form = createForm<SurveyValues>({
  initialValues: { mode: "simple" },
  schemas: createSchemas<SurveyValues>([
    {
      name: "mode",
      label: "模式",
      componentType: "select",
      componentProps: {
        options: [
          { label: "简单模式", value: "simple" },
          { label: "高级模式", value: "advanced" },
        ],
      },
    },
    {
      componentType: "dependency",
      to: ["mode"],
      renderer(values) {
        if (values.mode !== "advanced") return []

        return [
          {
            name: "detail",
            label: "详情",
            componentType: "input",
            rules: "required",
          },
        ]
      },
    },
  ]),
})

await form.waitForDependencies()

const viewSchemas = form.getViewSchemas()
```

异步 renderer 会收到 `AbortSignal`，当同一个 dependency 节点重新执行或被销毁时可取消上一次请求。

```ts
const form = createForm({
  schemas: [
    {
      componentType: "dependency",
      to: ["category"],
      async renderer(values, _form, context) {
        const response = await fetch(`/api/forms/${values.category}`, {
          signal: context.abortSignal,
        })

        return response.json()
      },
    },
  ],
})
```

## 校验

core 内置 `required`、`selectRequired`、`uploadRequired` 三个快捷规则，也可以注册任意 Standard Schema。

```ts
import { createForm } from "@schemx/core"
import { z } from "zod"

const form = createForm({
  initialValues: {
    email: "",
    age: 18,
  },
})

form.registerRules("email", z.string().email("邮箱格式错误"))
form.registerRules("age", z.number().min(18, "必须年满 18 岁"))

const result = await form.validate()

if (!result.ok) {
  console.log(result.error.errors)
}
```

### 规则注册表

当 schema 中希望复用字符串规则时，可以注入 `ValidatorsRegistryType`。

```ts
import { createForm, createValidatorsRegistry } from "@schemx/core"
import { z } from "zod"

const validatorRegistry = createValidatorsRegistry()

validatorRegistry.register("phone", z.string().regex(/^1[3-9]\d{9}$/, "手机号格式错误"))

const form = createForm({
  validatorRegistry,
  schemas: [
    {
      name: "phone",
      label: "手机号",
      componentType: "input",
      rules: ["required", "phone"],
    },
  ],
})
```

## 响应式监听

### effect

`effect` 会自动追踪回调中读取过的字段。

```ts
const dispose = form.effect(() => {
  console.log("email:", form.getFieldValue("email"))
})

form.setFieldValue("email", "hello@example.com")

dispose()
```

### watch

`createWatch` 提供字段级、字段组和全表监听。

```ts
import { createWatch, createWatchAll } from "@schemx/core"

const stopEmailWatch = createWatch(
  form,
  "email",
  (payload, latestSnapshot) => {
    console.log(payload.prevValue, "->", payload.value)
    console.log(latestSnapshot)
  },
  { immediate: true }
)

const stopAllWatch = createWatchAll(
  form,
  (payload) => {
    console.log(payload.changedPaths)
    console.log(payload.changedValues)
  },
  {}
)

stopEmailWatch()
stopAllWatch()
```

### batch

```ts
form.batch(() => {
  form.setFieldValue("name", "Jane")
  form.setFieldValue("email", "jane@example.com")
})
```

## 单字段控制器

`createField` 可以把表单实例的方法收窄到单个字段，适合框架适配层或自定义控件封装。

```ts
import { createField, createForm } from "@schemx/core"

const form = createForm({
  initialValues: {
    name: "",
  },
})

const nameField = createField(form, "name")

nameField.setValue("Jane")
nameField.registerRules("required")

const result = await nameField.validate()

if (!result.ok) {
  console.log(nameField.getError())
}
```

## 渲染器注册

core 不关心渲染器对象的具体形态。框架适配层可以注册 Vue 组件、React 组件、原生渲染函数或任意 renderer 描述。

```ts
import { createForm, createRendererRegistry } from "@schemx/core"

const rendererRegistry = createRendererRegistry()

rendererRegistry.register("input", InputRenderer)
rendererRegistry.register("select", SelectRenderer)

const form = createForm({
  rendererRegistry,
  schemas: [
    { name: "name", label: "姓名", componentType: "input" },
    { name: "role", label: "角色", componentType: "select" },
  ],
})

const inputRenderer = form.getRenderer("input")
```

也可以直接通过表单实例注册：

```ts
form.registerRenderer("date", DateRenderer)
form.hasRenderer("date")
form.getRenderer("date")
```

## ViewSchemas

UI 适配层通常只需要消费 ViewSchemas。它已经包含 core 解析后的 `visible`、`readonly`、`disabled`、`required`、`placeholder`、`componentProps` 和 `rules`。

```ts
const form = createForm({ schemas })

await form.waitForDependencies()

render(form.getViewSchemas())

const unsubscribe = form.subscribeViewSchemas((nextSchemas) => {
  render(nextSchemas)
})

unsubscribe()
```

当根 schema 需要整体替换或增量派生时，可以通过 form 实例更新，也可以把 `createSchemas` 返回的 schema source 交给 `createForm`：

```ts
form.setSchemas(nextSchemas)

form.updateSchemas((current) => [
  ...current,
  { name: "remark", label: "备注", componentType: "textarea" },
])

const schemas = createSchemas([{ name: "name", label: "姓名", componentType: "input" }])

const form = createForm({ schemas })

schemas.update((current) => [
  ...current,
  { name: "email", label: "邮箱", componentType: "input" },
])
```

## API 速查

### createForm(options)

| 选项                  | 说明                                                    |
| --------------------- | ------------------------------------------------------- |
| `schemas`             | 初始 schema 列表或 `createSchemas` 返回的 schema source |
| `initialValues`       | 初始值，也是 `reset()` 的还原基准                       |
| `modelValue`          | 外部受控值，用于创建实例时与初始快照合并                |
| `rendererRegistry`    | 渲染器注册表                                            |
| `defaultRendererType` | 字段未指定或查找不到 renderer 时使用的默认类型          |
| `validatorRegistry`   | 字符串规则注册表                                        |
| `validationTrigger`   | 默认校验触发时机，支持 `change` / `blur` / `submit`     |
| `readonly`            | 全局只读默认值                                          |
| `disabled`            | 全局禁用默认值                                          |
| `onFinish`            | `submit()` 校验通过回调                                 |
| `onFinishFailed`      | `submit()` 校验失败回调                                 |
| `onValuesChange`      | 字段值变化回调                                          |
| `onFieldsChange`      | 字段路径变化回调                                        |
| `lifecycleHooks`      | node 生命周期观察钩子                                   |

### SchemxInstance

| 分类       | 方法                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------- |
| 值         | `getFieldValue`、`getFieldsValue`、`setFieldValue`、`setFieldsValue`                              |
| 快照       | `getFieldSnapshot`、`getFieldsSnapshot`                                                           |
| 初始值     | `getInitialValue`、`getInitialValues`、`setInitialValues`                                         |
| touched    | `isFieldTouched`、`setFieldTouched`、`getTouchedFields`                                           |
| pending    | `setFieldPending`、`isFieldPending`、`getPendingFields`                                           |
| 校验       | `registerRules`、`unregisterRules`、`validateField`、`validate`、`getFieldError`、`setFieldError` |
| 提交与重置 | `submit`、`reset`、`resetFields`                                                                  |
| 响应式     | `effect`、`batch`                                                                                 |
| schema     | `setSchemas`、`updateSchemas`                                                                     |
| 默认配置   | `updateDefaultProps`                                                                              |
| view       | `getViewSchemas`、`subscribeViewSchemas`、`getViewRevision`、`waitForDependencies`                |
| renderer   | `getRenderer`、`registerRenderer`、`hasRenderer`                                                  |
| validator  | `getValidator`、`registerValidator`、`hasValidator`                                               |
| 生命周期   | `destroy`                                                                                         |

## 核心概念

### 运行时结构

```text
raw schemas
  -> compileToDescriptors
  -> commitChildren
  -> RuntimeReconciler
  -> RuntimeFiberManager
  -> ViewSchemas
```

- `compileToDescriptors` 将 raw schema 标准化为内部 descriptor。
- `RuntimeReconciler` 负责复用、创建和卸载 runtime fiber。
- `RuntimeFiberManager` 负责字段模型、校验 effect、dependency effect 和生命周期资源。
- `ViewSchemas` 是给框架适配层渲染的公开投影。

### 模块边界

```text
src/
├── createForm.ts       # 表单实例装配入口
├── descriptor/         # schema 编译
├── node/              # runtime fiber / reconciler / scope
├── field/              # 字段模型、字段注册、动态依赖 effect
├── store/              # 值、初始值、touched、pending 状态
├── validator/          # 规则注册与校验状态
├── view/               # ViewSchemas 构建与订阅
├── reactivity/         # signal、effect、batch
├── registry/           # renderer / rule registry
├── scheduler/          # 异步任务调度
├── lifecycle/          # lifecycle bus
├── types/              # 公开类型
└── utils/              # 路径、diff、schema 等工具
```

框架适配层应优先通过 `SchemxInstance` 的公开 API 消费 core 能力，避免直接依赖 `descriptor/`、`node/`、`field/` 等内部模块。

## 相关包

- `@schemx/vue`：Vue 3 适配层。
- `@schemx/vant`：基于 Vant 的 renderer 适配包。
- `@schemx/core`：当前包，框架无关表单引擎。
