# Release Notes

## 版本信息

- 基准版本：`@schemx/vue@0.2.3`
- 基准提交：`c9b1d20`
- 比较范围：`@schemx/vue@0.2.3..HEAD`
- 目标提交：`b2c8dc7`
- 当前分支：`dev`
- 生成日期：`2026-08-06`

## 概览

本轮同步了 Core 的表单配置、Schema 容器和校验契约，调整了 Vue 根导出、字段错误和表单上下文类型，并扩展了 App 级配置隔离、FormGroup 状态和受控 `modelValue` 行为。升级时需要优先处理下方的公共 API 迁移；包版本、导出路径和运行时依赖未变化。

## Breaking Changes

### @schemx/vue：校验注册表与字段错误 API

- 根入口中的 `validatorRegistry` 统一改为 `validationRuleRegistry`；旧的 `createValidatorsRegistry` 等名称也不再作为当前公共入口。`useForm`、`SchemxForm` 配置和校验规则注册统一使用新的命名。
- `FieldInstance.error` 改为只读的 `FieldInstance.errors` 计算值；错误读取使用 `getErrors()`，不再使用旧的单数错误 API。`errors` 始终提供只读字符串数组。

#### 迁移说明

```ts
import { useField, useForm, validationRuleRegistry } from "@schemx/vue"

const form = useForm({ validationRuleRegistry })
const field = useField("email")

console.log(field.errors.value)
console.log(field.getErrors())
void form
```

### @schemx/vue：表单属性与配置上下文边界

- `SchemxFormProps` 不再继承 Core 的旧 `SchemxProps`，改为由 Vue 层显式声明 `schemas`、`initialValues`、`modelValue`、`form`、样式、回调和生命周期属性，并组合新的 Schema 配置类型。
- `FormContextProps` 收敛为 `{ schemaConfig }`。自定义上下文 Provider 和消费者应使用 `createFormConfigContext` / `useFormConfigContext`，不再读取旧的扁平上下文字段。
- `useForm` 的表单配置使用 `schemaConfig` 承载字段默认呈现配置；`SchemxForm` 的扁平 Schema 属性仍由 Vue 适配层映射到该结构。依赖旧 `SchemxProps`、旧上下文字段或 `updateDefaultProps` 的封装需要调整。

#### 迁移说明

```ts
import { createFormConfigContext, useForm, useFormConfigContext } from "@schemx/vue"

const form = useForm({
  schemaConfig: { readonly: true, validationTrigger: "blur" },
})

createFormConfigContext({
  schemaConfig: { labelAlign: "right" },
})

const { schemaConfig } = useFormConfigContext()
void form
void schemaConfig
```

### @schemx/vue：Group/Dependency Schema 契约

- Group 不再依赖 `componentType: "group"`，改由包含 `children` 的 Schema 识别；Dependency 不再依赖 `componentType: "dependency"`，改用 `to` 与 `renderer` 结构。普通字段仍可使用名为 `group` 或 `dependency` 的 renderer key。

#### 迁移说明

```ts
const schemas = [
  {
    label: "个人信息",
    children: [{ name: "email", label: "邮箱", componentType: "text" }],
  },
  {
    to: ["showAdvanced"],
    renderer: (values) =>
      values.showAdvanced
        ? [{ name: "remark", label: "备注", componentType: "text" }]
        : [],
  },
]
```

### @schemx/vue：Dictionary 公共类型

- `SchemxDictionary` 从 `<TValues, R = any>` 扩展为 `<TValues, TResponse = unknown, TOption = unknown>`，`formatter`、`onSuccess` 和 `UseDictionaryReturn<TOption>` 现在可保持响应数据与选项类型；未显式指定类型的旧代码可能需要补充泛型。

#### 迁移说明

```ts
import type { SchemxDictionary } from "@schemx/vue"

type FormValues = { city: string }
type CityOption = { label: string; value: string }
type CityResponse = { items: CityOption[] }

const dictionary: SchemxDictionary<FormValues, CityResponse, CityOption> = {
  api: async () => ({ items: [] }),
  formatter: (response) => response.items,
}
```

## Features

- `SchemxForm` 插件支持按 Vue App 隔离的安装配置；`app.use(SchemxForm, options)` 可配置 `schemaConfig`、`validatorAdapters`、`defaultRendererType`、`rendererRegistry` 和 `validationRuleRegistry`，不同 App 互不污染。
- 配置优先级明确为表单显式配置 > App 安装配置 > Vue 模块默认注册表 > Core 全局配置 > Core 默认值；`validatorAdapters` 支持累积注册，并可通过 `{ adapter, override: true }` 覆盖同 ID 适配器。
- FormGroup 状态契约得到扩展：支持 `visible`、`readonly`、`disabled`、受控 `collapsed`、`onCollapsedChange`、`destroyOnCollapse` 以及对应的 ARIA 属性和关联 ID。默认折叠时销毁内容，`destroyOnCollapse=false` 时保留内容并隐藏。
- `FormItem` 将必填校验与 `showRequiredMark` 视觉标记分开处理；未显式设置标记时跟随 `required`，只读或禁用字段不显示标记且不参与交互校验。

## Fixes

- 外部 `modelValue` 更新通过 `setFieldsValue` 同步到表单，并避免同步过程重复触发相同的 `update:modelValue` 事件。
- 响应式 Schema、动态组件属性和 Dependency 子树更新的边界更稳定，减少相同配置重复写入；可见 Group 现在作为表单项区段边界参与首尾样式计算。
- 字段触发器和标签布局统一读取 `formContext.schemaConfig`，必填字段在没有显式 rules 时也能进入校验展示逻辑。

## Improvements

- Vue 表单组件、Hooks 和公共类型统一使用 `TValues` 泛型命名，并新增 `tsconfig.type-tests.json`；`build` 现在会先执行 `type-check`，且类型检查包含公共类型测试。
- `FieldInstance` 将 Core 字段状态映射为更明确的 Vue 响应式类型，`dirty`、`pending` 和 `errors` 使用只读计算值表达。
- Vue 层的 Core 类型扩展和表单组件泛型声明更加显式，`class`、`style` 等 Schema 扩展属性集中在公共类型入口声明，便于 Vue SFC 类型推导。

## Dependencies and Compatibility

- `@schemx/vue` 继续依赖 `@schemx/core`，本范围内 `package.json` 的版本、`exports`、peerDependencies 和运行时依赖未改变；主要兼容性风险来自 Core 公共配置、Schema 和校验契约的同步重构。
- `@schemx/vant` 通过 Vue/Core 导出链继承新的注册表、字段错误和配置类型；升级时应将 `@schemx/core`、`@schemx/vue` 与 `@schemx/vant` 作为同一兼容性批次检查。

## Documentation

- 更新 Vue README，补充 App 安装配置、扁平 Schema 属性、`FieldInstance.errors`、Group 折叠、字典泛型和新的校验注册表名称。

## Affected Packages

- `@schemx/vue`：表单组件、Hooks、插件配置、上下文和公共类型直接变化。
- `@schemx/core`：Vue 层依赖新的 Schema、配置、校验和字段错误契约。
- `@schemx/vant`：依赖 Vue/Core 导出并继承相关类型变化。
