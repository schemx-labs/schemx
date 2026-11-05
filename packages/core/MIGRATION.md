# 从 1.x 迁移至 2.0

本文介绍 2.0 对 Core 弃用 API 的移除及替代方式。这些变更属于破坏性变更，不适用于 1.x 补丁或次版本发布。请同时升级项目使用的 Schemx 框架和 UI 适配包至与 Core 2.0 兼容的版本。

## 1. 模块级全局配置改为独立工厂

根入口不再导出 `configureSchemx()` 和 `getGlobalSchemxConfig()`。直接调用 `createForm(options)` 只使用本次传入的配置和 Core 内置默认值，不再继承模块级全局状态。

旧写法：

```ts
import { configureSchemx, createForm, getGlobalSchemxConfig } from "@schemx/core"

configureSchemx({ schemaConfig: { readonly: true } })
const form = createForm({ initialValues: { name: "" } })
const config = getGlobalSchemxConfig()
```

新写法：

```ts
import { createSchemx } from "@schemx/core"

const api = createSchemx({ schemaConfig: { readonly: true } })
const form = api.createForm({ initialValues: { name: "" } })
const config = api.getConfig()

api.configureSchemx({ schemaConfig: { readonly: false } })
// 更新只影响此工厂后续创建的表单，已有 form 保持原配置。
const nextForm = api.createForm({ initialValues: { name: "" } })

api.configureSchemx() // 清空业务覆盖层，恢复创建工厂时的基线。
form.destroy()
nextForm.destroy()
```

`api.configureSchemx()` 每次替换业务覆盖层；它不能替换工厂的 Registry。Registry 请在 `createSchemx()` 时传入。`api.getConfig()` 返回此工厂的默认配置，不是全局配置，也不包含 Core 内置默认值。

Vue 项目可使用 `@schemx/vue` 的 `createSchemx()` 保留 Vue 默认值，或把配置放在 App 安装选项、ConfigProvider、Form 中。Core 工厂不会自动成为 Vue App 的配置：需要使用 `createFormComponent(api.createForm)` 接入该工厂，或将创建的 Form 传给组件。具体用法见 [Vue README](../vue/README.md)。

## 2. 布局类型归属框架适配层

`@schemx/core` 不再导出 `SchemxLayout`，Field、Group、Dynamic 的基础类型不再声明 `layout`。

| 原配置                      | 推荐配置                                                             |
| --------------------------- | -------------------------------------------------------------------- |
| Field 的 `layout`           | 框架适配层扩展的 `col`                                               |
| Group / Dynamic 的 `layout` | 框架适配层扩展的 `row`；容器布局请按适配层定义迁移                   |
| Core 的 `SchemxLayout`      | 框架适配层的列或行类型；Vue 为 `SchemxColConfig` / `SchemxRowConfig` |

Vue 字段示例：

```ts
import type { SchemxColConfig, SchemxField } from "@schemx/vue"

const col: SchemxColConfig = { span: 12, offset: 1 }
const field: SchemxField<{ name: string }> = {
  name: "name",
  label: "姓名",
  componentType: "input",
  col, // 原先为 layout: { span: 12, offset: 1 }
}
```

`row` 与旧列布局对象不是同一个契约，不要直接把 `{ span: 12 }` 改名为 `row`。例如，Vue 的 `row` 使用 `gutter`、`justify`、`align`。Vue 包自身的旧布局兼容入口不在本次 Core 移除范围内，新代码应使用上述类型。

## 3. 展示属性和折叠配置使用框架扩展

以下属性从 Core 的内置声明中移除：

| 原位置                | 移除的属性                                                                                            | 扩展接口                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Field                 | `labelIcon`、`labelAlign`、`labelPosition`、`labelWidth`、`contentAlign`、`colon`、`showRequiredMark` | `SchemxFieldDefinition`                                             |
| Field dependencies    | `showRequiredMark`                                                                                    | `SchemxFieldDependenciesDefinition`                                 |
| Group                 | `collapsible`、`defaultCollapsed`、`collapsed`、`onCollapsedChange`、`destroyOnCollapse`              | `SchemxGroupFieldDefinition`                                        |
| `defaultSchemxConfig` | 上述七个 Field 展示属性                                                                               | `SchemxSchemaConfigDefinition` 声明配置类型，由框架适配层提供默认值 |

Vue 已通过声明合并提供这些展示属性和折叠配置。使用 Vue 时，从 `@schemx/vue` 或对应 UI 适配包的公开入口导入，确保框架类型扩展被加载；原有 `labelWidth`、`showRequiredMark` 等配置可继续使用。

框架适配层（Vue、React、...）的作者需要分别声明字段属性、默认配置及动态属性。只有类型声明不会自动提供默认值或 UI 行为。例如，自定义适配层可以这样声明：

```ts
import type { SchemxConditionFn, Values } from "@schemx/core"

declare module "@schemx/core" {
  interface SchemxFieldDefinition {
    showRequiredMark?: boolean
  }
  interface SchemxSchemaConfigDefinition {
    showRequiredMark?: boolean
  }
  interface SchemxFieldDependenciesDefinition<TValues extends Values = Values> {
    showRequiredMark?: SchemxConditionFn<TValues, boolean>
  }
}
```

Core 继续透传扩展元数据并解析已声明的动态属性。必填校验仍由 `required` 控制；运行时必填视觉标记在未显式配置时仍跟随有效 `required`。

Core 不再为展示属性补默认值。例如 `labelWidth` 不再自动回退为 `"auto"`；显式设置 `undefined` 时也不会获得此默认值。请由框架适配层补齐展示默认值。Core 也不再因 `readonly: true` 强制把 `contentAlign` 改为 `"right"`、`labelPosition` 改为 `"left"`；Vue Field 层继续提供原有的只读对齐样式，Vue、Vant 和 Element Plus 的内置字段显示效果保持兼容；自定义框架适配层需要自行处理该展示策略。

## 4. Renderer 的值和事件由框架声明

Core 的 `SchemxBaseComponentProps` 不再内置 `align`、`value`、`"onUpdate:value"`、`onChange`、`onBlur`。公共值和事件通过 `SchemxComponentPropsDefinition` 扩展；某个 Renderer 的对齐属性等专属配置通过 `SchemxRendererDefinition` 声明。

`SchemxBaseComponentProps` 的 `TName`、`TValue` 泛型同时移除，只保留 `TValues`。需要特定字段值类型的 Renderer，请在自己的 Props 中声明；不要继续传入三个泛型参数。

```ts
import type { FieldValue, Values } from "@schemx/core"

declare module "@schemx/core" {
  interface SchemxComponentPropsDefinition<TValues extends Values = Values> {
    value?: FieldValue<TValues>
    onChange?: (value: FieldValue<TValues>) => void
  }
  interface SchemxRendererDefinition<TValues extends Values> {
    text: {
      align?: "left" | "center" | "right"
      format?: (value: FieldValue<TValues>) => string
    }
  }
}
```

Vue 已提供值与事件的声明及运行时绑定，通常无需业务方重复声明。

## 发布前检查

- 将这批移除随 2.0 主版本发布；不要以当前 1.x 版本号发布。
- 检查 `configureSchemx` 的调用对象：工厂实例上的同名方法保留，模块级导入需要迁移。
- 检查 Core 的 `SchemxLayout` 导入和 `SchemxBaseComponentProps` 的泛型参数。
- 检查框架适配层是否提供展示默认值、字段扩展、动态扩展和 Renderer 事件。
- 使用框架与 UI 适配包的兼容版本，运行项目的类型检查、表单交互及校验测试。
