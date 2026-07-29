# Release Notes

## 版本信息

- 基准版本：`@schemx/vue@0.2.3`
- 比较范围：`@schemx/vant@0.2.3..HEAD`
- 基准提交：`c9b1d20`
- 目标提交：`0a732d7`
- 当前分支：`dev`
- 生成日期：2026-07-29

## 概览

`@schemx/vue` 已同步 Core 新的 Form、校验和 Schema 契约。表单组件的配置边界更清晰，`FormGroup` 支持完整容器状态与受控折叠，字段错误状态统一采用只读数组。

## Breaking Changes

### Registry 与字段错误状态

- 根入口 `validatorRegistry` 已重命名为 `validationRuleRegistry`；`SchemxForm` Props 和 `useForm()` 相关配置也使用 `validationRuleRegistry`，旧配置名不再传递给 Core。
- `FieldInstance.error` 已移除，改为 `FieldInstance.errors: ComputedRef<readonly string[]>`。无错误时返回空数组，不能再按 `undefined` 分支处理。

#### 迁移说明

```ts
// 旧写法
import { validatorRegistry } from "@schemx/vue"

const field = useField("email")
if (field.error.value) show(field.error.value[0])

// 新写法
import { validationRuleRegistry } from "@schemx/vue"

const field = useField("email")
if (field.errors.value.length > 0) show(field.errors.value[0])
```

### Props 类型来源与 Form 配置

- `SchemxProps` 已不再从 `@schemx/core` 提供；Vue 组件 Props 请使用 `@schemx/vue` 的 `SchemxFormProps`。
- 表单默认字段状态会被收集为 Core `schemaConfig` 并同步给已创建的 Form；自定义封装若直接调用 Core `createForm()`，需要将字段默认值写入 `schemaConfig`，不要继续依赖已移除的 `updateDefaultProps()`。
- Group/Dependency Schema 不再依赖 `componentType` 判别。Vue 的 Group 识别改为检查 `children`，因此自定义 Schema 类型应删除 `componentType: "group"` / `"dependency"`。

#### 迁移说明

```ts
// Vue 组件仍可使用顶层 Props；组件内部会转为 schemaConfig
<SchemxForm :readonly="true" :validation-trigger="'blur'" />

// 直接使用 Core 时
createForm({
  schemaConfig: { readonly: true, validationTrigger: "blur" },
})
```

## Features

### Group 容器交互与可访问性

- `FormGroup` 支持 `visible`、`readonly`、`disabled`、`collapsed`、`onCollapsedChange`、`destroyOnCollapse` 与 dependencies 驱动的状态。禁用的可折叠 Group 不会响应鼠标或键盘切换。
- Group 折叠标题提供 `role="button"`、`aria-expanded`、`aria-controls` 与 `aria-disabled`；Enter 和 Space 可切换折叠状态。
- 当 `destroyOnCollapse: false` 时，折叠仅以 `display: none` 隐藏内容；默认 `true` 时会卸载子 renderer。

### 样式与类型扩展

- 通过 declaration merging，字段和 Group Schema 可声明 `class` 与 `style`；`FormItem` 和 `FormGroup` 会将其应用到对应容器。
- `SchemxFormProps` 由拆分的 `FormSchemaOptions`、`FormRegistryOptions`、`FormCallbackOptions`、`FormLifecycleOptions` 与 `SchemxSchemaConfig` 组合，保留 Vue 专属的 `modelValue`、`form`、`class`、`style`。
- Vue 公开泛型统一为语义化的 `TValues`，并新增类型测试配置以校验字段、表单与 renderer 的推导。

## Fixes

- `FormItem` 现在会在字段设置 `required`、即使未设置额外 `rules` 时参与校验触发判断；此前仅存在 `rules` 才会触发校验。
- `showRequiredMark` 仅控制必填星号展示，未设置时回退到 `required`；视觉标记与实际校验不再相互混淆。
- 使用外部传入的响应式 `SchemxSchemas` 时，组件不会重复调用 `setSchemas()`，避免破坏该 Schema source 的自身更新链路。
- 表单上下文只提供 `schemaConfig`，FormItem 从其中读取标签位置、宽度、对齐、冒号与校验触发条件，避免 UI Props 被误当成 Core 实例配置。

## Improvements

- `SchemxFormPlugin` 现在基于 `typeof SchemxForm` 推导组件类型，改善插件与泛型 SFC 的类型一致性。
- 构建前的 `type-check` 会继续执行 `type-test`，提高公开 Props、FieldInstance 和 Form 类型变更的检查覆盖率。

## Documentation

- 更新 Vue README，说明新的 Props 边界、校验结果、Group 容器状态与跨包 API 用法。

## Affected Packages

- `@schemx/vue`（直接修改）
- `@schemx/core`（提供 Form、Schema 与校验契约）
