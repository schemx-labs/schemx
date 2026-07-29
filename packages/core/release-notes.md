# Release Notes

## 版本信息

- 基准版本：`@schemx/core@0.2.3`（与最近可达 Tag `@schemx/vant@0.2.3` 指向同一基准提交）
- 比较范围：`@schemx/vant@0.2.3..HEAD`
- 基准提交：`c9b1d20`
- 目标提交：`0a732d7`
- 当前分支：`dev`
- 生成日期：2026-07-29

## 概览

本版本重构了 Form、Schema Runtime 与校验器的公共契约。校验规则、错误结果和 Registry 统一改用 `Validation*` / `Rule*` 命名；Group 与 Dependency 获得容器状态；Form 新增全局与实例级 `schemaConfig` 配置层。

这是一次包含明确 Breaking Changes 的版本。直接使用 `@schemx/core` 的校验、Schema 类型或 Form 配置 API 的项目应先完成下列迁移再升级。

## Breaking Changes

### 校验 Registry、规则与结果模型

- `createValidatorsRegistry`、`ValidatorsRegistryType`、`ValidatorsRegistryOptions`、`ValidatorsFactory`、`ValidatorsEntry`、`ValidatorsEntryMap` 已移除，分别替换为 `createValidationRuleRegistry`、`ValidationRuleRegistry`、`RegistryOptions`、`ValidationRuleFactory`、`ValidationRuleEntry` 与 `ValidationRuleMap`。
- Form 选项 `validatorRegistry` 改名为 `validationRuleRegistry`；表单实例方法 `getValidator`、`registerValidator`、`hasValidator` 改为 `getRule`、`registerRule`、`hasRule`。
- `ValidateResult`、`ValidateError`、`FieldError`、`SchemxRules`、`SchemxRuleDefinition*` 不再从 Core 导出。字段 `rules` 现在采用 `FieldRule` / `FieldRules`，校验结果采用 `ValidationResult`、`ValidationSuccess`、`ValidationFailure`、`ValidationCancelled` 与 `ValidationError`。
- 旧结果中的 `ok` / `error` 结构不再适用。新结果通过 `valid` 判别：成功结果为 `{ valid: true, values, errors: [] }`；普通失败包含字段或表单级 `errors`；被新一轮校验、规则替换或销毁中止时返回 `{ valid: false, cancelled: true, values, errors: [] }`。
- 内置 `createRequiredRule`、`createSelectRequiredRule`、`createUploadRequiredRule` 已移除，替换为 `createRequiredValidationRule` 与 `createStandardSchemaValidationRule`。组件专属必填规则应迁移到字段 `required`，第三方规则应使用 Standard Schema 或校验 adapter。

#### 迁移说明

```ts
// 旧写法
import { createValidatorsRegistry, createForm } from "@schemx/core"

const validatorRegistry = createValidatorsRegistry()
const form = createForm({ validatorRegistry })
form.registerValidator("phone", phoneRule)

// 新写法
import { createValidationRuleRegistry, createForm } from "@schemx/core"

const validationRuleRegistry = createValidationRuleRegistry()
const form = createForm({ validationRuleRegistry })
form.registerRule("phone", phoneRule)
```

校验返回值应改为判别 `valid` 与 `cancelled`，不要继续读取旧的 `ok` 或 `error` 字段：

```ts
const result = await form.submit()

if (result.valid) {
  consume(result.values)
} else if (!result.cancelled) {
  showErrors(result.errors)
}
```

### 字段与 Form 实例 API

- `SchemxFieldInstance#getError()`、`setError()`、`clearError()`、`registerRules()`、`unregisterRules()` 已分别改为 `getErrors()`、`setErrors()`、`clearErrors()`、`setRules()`、`removeRules()`。`getErrors()` 在无错误时返回只读空数组，而不是 `undefined`。
- `SchemxInstance#getFieldError()`、`setFieldError()`、`registerRules()`、`unregisterRules()` 已替换为 `getFieldErrors()`、`setFieldErrors()`、`clearFieldErrors()`、`setFieldRules()`、`removeFieldRules()`；`submit()` 从 `Promise<void>` 改为 `Promise<ValidationResult<TValues>>`。
- `updateDefaultProps()` 已替换为 `updateSchemaConfig()`；表单级字段默认值由平铺选项收敛到 `schemaConfig`。

#### 迁移说明

```ts
// 旧写法
field.getError()
field.registerRules([rule], "校验失败")
form.updateDefaultProps({ readonly: true })

// 新写法
field.getErrors()
field.setRules([rule])
form.updateSchemaConfig({ readonly: true })
```

### Schema 与组件 Props 类型边界

- `SchemxProps` 已从 `@schemx/core` 移除；Vue 组件 Props 请改为从 `@schemx/vue` 导入 `SchemxFormProps`。`modelValue`、`form`、`class`、`style` 等 UI 层属性不再属于 Core 类型。
- `SchemxDefaultProps` 已由 `SchemxSchemaConfig` 取代。`CreateFormOptions` 拆分为 `FormSchemaOptions`、`FormRegistryOptions`、`FormCallbackOptions` 与 `FormLifecycleOptions`，以 `CreateFormOptions` 作为聚合入口。
- Group 不再使用 `componentType: "group"`，而以 `children` 识别；Dependency 不再使用 `componentType: "dependency"`，而以 `to` 和 `renderer` 识别。继续保留这两个 `componentType` 会导致类型不兼容。

#### 迁移说明

```ts
// 旧 Group / Dependency
{ componentType: "group", label: "基础信息", children: [] }
{ componentType: "dependency", to: ["type"], renderer: () => [] }

// 新 Group / Dependency
{ label: "基础信息", children: [] }
{ to: ["type"], renderer: () => [] }
```

## Features

### 配置与校验扩展

- 新增 `configureSchemx()`：可为后续 `createForm()` 调用设置全局 `schemaConfig`、`validatorAdapters`、默认 renderer 类型、共享 `rendererRegistry` 与共享 `validationRuleRegistry`。重复调用采用替换语义，不会与上次全局配置合并。
- 新增 `ValidationAdapterV1` / `ValidationAdapter` 协议，以及 `validatorAdapters` 配置。adapter 可通过 Form 选项或全局配置注册；Form 级 adapter 会追加在全局 adapter 之后，并可用 `override` 覆盖同 ID adapter。
- Core 内置 Standard Schema 支持，并提供统一的 `ValidationRuleContext`、`ValidationRuleIssue` 与可区分字段/表单范围的错误模型。

### Group 与 Dependency 容器状态

- Group 新增 `visible`、`readonly`、`disabled`、`dependencies`、`collapsed`、`onCollapsedChange`、`destroyOnCollapse`。隐藏 Group 时，其后代不再参与校验，但字段值会保留。
- Dependency 新增 `visible`、`readonly`、`disabled` 和 `dependencies`。隐藏 Dependency 时，动态结构仍会响应 `to`，但不会呈现子树。
- `destroyOnCollapse` 默认值为 `true`；设置为 `false` 时，Group 折叠会隐藏而非卸载后代 Renderer。

### Schema 默认值

- 新增 `schemaConfig`、`schemaConfigKeys` 与内置默认值合并机制。支持 `required`、`readonly`、`disabled`、`visible`、`labelIcon`、`labelAlign`、`labelPosition`、`labelWidth`、`contentAlign`、`validationTrigger`、`colon` 与 `showRequiredMark`。
- `showRequiredMark` 与 `required` 分离：未显式设置时跟随 `required`；显式设置后仅控制视觉标记，不改变校验逻辑。

## Fixes

- `submit()` 现在将校验结果返回给调用方；成功后才调用 `onFinish`，失败后通过结构化 `ValidationFailure` 调用 `onFinishFailed`，取消结果不会被当作普通失败处理。
- 重构 Dependency 的调度链路，缩小动态属性 effect 的订阅范围，避免用户回调读取无关字段时污染依赖订阅。
- 在规则替换、字段删除或实例销毁时中止过期异步校验，避免陈旧错误写回当前字段状态。

## Improvements

- Form 内部拆分为 Model、Runtime、Controller、Observer、Bindings 与稳定 Facade，运行时模块迁移到 `runtime/` 命名空间；这属于内部组织调整，包根入口和 `package.json#exports` 未增加新的运行时子路径。
- `SchemxExactBaseField` 将字段名、字段值与 renderer Props 关联，`SchemxBaseField` 保持供运行时更新使用的宽化类型，改善大型 Schema 的类型推导与编译复杂度。
- 新增 Core 类型测试配置与 `pnpm run type-test` 脚本；发布构建前可额外验证公开类型。

## Documentation

- 更新 Core README：覆盖新的校验结果、Form API、字段控制器、配置层与迁移后的规则写法。

## Affected Packages

- `@schemx/core`（直接修改）
- `@schemx/vue`（直接依赖 Core Form、Schema 与校验 API）
- `@schemx/vant`（经 Vue/Core 的类型与 renderer 契约受影响）
- `@schemx/validator`（为新的 adapter 协议提供实现）
