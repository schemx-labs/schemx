# Release Notes

## Unreleased

### 新增功能

- 新增 `rendererProps`，可按 Renderer 类型设置静态默认 Props；字段 `componentProps`、动态依赖结果与 Runtime 注入属性仍具更高优先级。
- 新增 `createFormExternalStore()` 及 `ExternalStore`、`FormExternalStore`、`FieldExternalStore`、`FieldStateSnapshot` 类型，为 UI 适配层提供稳定快照与按需订阅协议。

### 优化与调整

- `SchemxInstance` 新增 `isLoading()`；提交 loading 覆盖依赖等待、校验和异步 `onFinish`。
- `createForm()` 支持 `onReset` 与 `onLoadingChange` 回调；完整 `reset()` 会触发 `onReset`，`resetFields()` 不会触发。
- `SchemxRuntimeInjectedProp` 与 `SchemxRendererPropsMap` 已从根入口导出，便于为自定义 Renderer 编写类型安全的默认 Props。

## 版本信息

- 基准版本：`@schemx/core@0.2.3`
- 基准提交：`c9b1d20`
- 比较范围：`@schemx/core@0.2.3..HEAD`
- 目标提交：`b2c8dc7`
- 当前分支：`dev`
- 生成日期：`2026-08-06`

## 概览

本轮重构了 Core 的表单配置、Schema 运行时和校验契约，新增 Group/Dependency 容器状态、统一的 `ValidationResult` 以及可组合的全局配置 API。公共导出、表单实例方法、规则注册方式和容器 Schema 形态均有不兼容变化，升级时需要按下方迁移说明检查调用方。

## Breaking Changes

### @schemx/core：校验结果、规则注册与表单校验 API

- 旧的 `ValidatorsRegistry` / `createValidatorsRegistry` 体系改为 `ValidationRuleRegistry` / `createValidationRuleRegistry`，表单配置项 `validatorRegistry` 改为 `validationRuleRegistry`；规则注册、查询和移除方法统一为 `registerRule`、`getRule`、`hasRule`、`setFieldRules` 和 `removeFieldRules`。
- 旧的 `ValidateResult`、`ValidateError`、`FieldError` 结果模型改为以 `valid` 为判别字段的 `ValidationResult`。成功结果包含 `values`，失败结果包含带 `scope`、`name` 和 `issues` 的结构化错误；被新一轮校验中止的结果使用 `cancelled: true` 表示。
- `submit()` 从 `Promise<void>` 改为 `Promise<ValidationResult<TValues>>`；`validate()`、`validateField()`、`createValidator().validate()` 也返回同一结果模型。字段实例的 `getError` / `setError` / `clearError` 改为 `getErrors` / `setErrors` / `clearErrors`，规则方法的 `registerRules` / `unregisterRules` 改为 `setRules` / `removeRules`。
- Core 的校验入口统一接收原生 `ValidationRule` 和 Standard Schema；第三方校验器通过 `ValidationAdapterV1` / `validatorAdapters` 接入，旧的第三方规则注册边界不再作为 Core 当前入口。

### 移除 createEffect，统一使用 Signal effect/watch API

@schemx/core 根入口不再导出 createEffect、CleanupFn、EffectCallback、CreateEffectReturn；同时公开 createSignalEffect、runSignalUntracked、createSignalWatch 和 createDebouncedSignalWatch。

影响范围：直接从 @schemx/core 导入旧 effect API，或依赖旧 cleanup-return / debounce effect 形态的项目。

#### 迁移说明

迁移方式需要维护者补充。

替代方案：createSignalEffect、createSignalWatch、createDebouncedSignalWatch、runSignalUntracked

升级前：

```ts
const stop = createEffect(() => {
  readSignal()
  return cleanup
})
```

升级后：

```ts
const stop = createSignalEffect(() => {
  readSignal()
})
```

#### 迁移说明

```ts
import { createForm, createValidationRuleRegistry } from "@schemx/core"

const validationRuleRegistry = createValidationRuleRegistry()
validationRuleRegistry.register("phone", phoneRule)

const form = createForm({ validationRuleRegistry })
const result = await form.submit()

if (result.valid) {
  save(result.values)
} else if (!result.cancelled) {
  showErrors(result.errors)
}
```

必填校验应优先使用字段的 `required` 配置，自定义校验应通过 `ValidationRule`、Standard Schema 或 `validatorAdapters` 接入。调用方还应将 `getFieldError` / `setFieldError` 等单数错误 API 更新为对应的复数 API，并区分普通失败与 `cancelled` 结果。

### @schemx/core：Renderer Registry 查询与类型 API

- 根入口的 `RendererRegistryType` 改为 `RendererRegistry`；`getRenderer`、`hasRenderer`、`getTypes`、`setDefault`、`getDefault` 分别改为 `resolve` / `get`、`has`、`keys`、`setFallback`、`getFallback`。
- `get()` 现在是不会回退或告警的纯查询；需要保留旧的默认渲染器回退语义时应改用 `resolve()`。

#### 迁移说明

```ts
const renderer = rendererRegistry.resolve("text") // 需要回退语义
const exact = rendererRegistry.get("text") // 只查精确类型
const hasRenderer = rendererRegistry.has("text")
rendererRegistry.setFallback("input")
```

### @schemx/core：表单配置与框架层类型边界

- 旧的 `SchemxDefaultProps` / `SchemxProps` 统一配置模型被拆分为 `FormSchemaOptions`、`FormRegistryOptions`、`FormCallbackOptions`、`FormLifecycleOptions` 和 `CreateFormOptions`；字段默认呈现配置需放入 `schemaConfig`，`defaultRendererType` 等注册表选项仍位于表单配置顶层。
- `updateDefaultProps` 改为 `updateSchemaConfig`。Vue 专属的 `modelValue`、`form` 等组件属性由 `@schemx/vue` 的 `SchemxFormProps` 承接，不再依赖 Core 的旧统一属性类型。

#### 迁移说明

```ts
const form = createForm({
  schemaConfig: {
    readonly: true,
    validationTrigger: "change",
  },
  defaultRendererType: "text",
})

form.updateSchemaConfig({ disabled: true })
```

### @schemx/core：Group/Dependency Schema 契约

- Group 不再使用 `componentType: "group"`，改用 `children`；Dependency 不再使用 `componentType: "dependency"`，改用 `to` 与 `renderer`。旧容器标记会产生兼容警告并被过滤。
- Schema 编译会校验字段的 `name`、`label`、`componentType` 以及 Dependency 的 `to`、`renderer` 形状；不满足契约的输入可能抛出 `CompileError`。

#### 迁移说明

```ts
const schemas = [
  {
    label: "个人信息",
    children: [{ name: "nickname", label: "昵称", componentType: "text" }],
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

### @schemx/core：公共 Schema 泛型与依赖类型

- `SchemxBase` 现在按 `<TValues, TName, TKey>` 描述表单值、字段路径和渲染器键；显式使用旧泛型参数顺序的代码需要重新检查类型参数。字段依赖类型也按普通字段、Group 和 Dependency 拆分为 `SchemxFieldDependencies`、`SchemxGroupDependencies` 和 `SchemxDependencyDependencies`。

## Deprecations

- 根入口仍暴露 `schemaConfigKeys`、`excludeSchemaConfigKeys`、`SchemxDependencies` 和 `SchemxDependenciesStaticProps` 等兼容名称；这些名称在源码中已标记弃用，新代码应使用 `defaultSchemxConfigKeys`、`excludeSchemxConfigKeys`、`SchemxFieldDependencies` 和 `SchemxFieldDependenciesStaticProps`。

## Features

- 新增 createSignalWatch 与 createDebouncedSignalWatch，支持 immediate、once、equals、wait、edges，以及 run、cancel、flush、dispose 控制器。（影响范围：需要直接监听 Core Signal，或需要可取消、可手动触发的防抖监听逻辑的调用方。）
- View 模块新增 `isViewGroupSchema` 与 `isSchemxViewFieldSchema` 类型守卫，并从 `@schemx/core` 根入口导出，可用于区分分组 ViewSchema 与可直接渲染的字段 ViewSchema。
- Group 新增 `visible`、`readonly`、`disabled`、`dependencies`、`collapsible`、`defaultCollapsed`、`collapsed`、`onCollapsedChange` 和 `destroyOnCollapse` 等配置；容器状态会递归约束后代字段，隐藏后代会移出校验范围但保留表单值。
- Dependency 支持动态子树及 `visible`、`readonly`、`disabled`、`dependencies` 状态；动态渲染器接收当前值、Form API 和 `AbortSignal` 上下文。
- 新增 `configureSchemx`、`getGlobalSchemxConfig`、`mergeSchemxConfig`、`resolveSchemxConfig` 和 `mergeAndResolveSchemxConfig`。全局配置只影响后续创建的 Form，表单显式配置优先；合并函数可分别执行纯合并、默认值解析或两者组合。
- 原生规则、Standard Schema 和第三方适配器共享新的校验协议；`ValidationRuleRegistry` 支持注册、批量注册、解析、订阅和动态更新，`ValidationAdapterV1` 提供显式协议版本。
- `required` 与 `showRequiredMark` 分离：前者控制必填校验，后者只控制视觉标记；未显式配置标记时跟随当前有效的 `required` 值。

## Fixes

- 动态依赖计算会隔离用户回调中的响应式读取，仅根据声明的 `triggerFields` 触发，减少无关字段变化造成的重复计算。
- 异步 Dependency renderer 和字段校验均支持取消与过期结果抑制；旧请求晚于新请求完成时不会覆盖最新状态，取消结果不会被当作普通校验失败提示。
- Group/Dependency 的可见性、只读和禁用状态会递归同步到后代运行时节点；隐藏字段清理校验规则和错误时仍保留字段值。
- createSignalEffect(fn, { once: true }) 现在会在首次执行后立即释放，不再继续响应后续 Signal 变化。
- 动态属性、Dependency renderer、调度任务、字段校验、Scope cleanup 和 waitAll 的异常现在输出带字段、Schema 或任务上下文的 [schemx] 日志；缺少 onError 的任务也不再静默处理。（影响范围：依赖动态属性、异步任务或自定义校验规则出现异常时，开发调试信息更完整。）
- 传给 Renderer 的 formItemProps 现在使用归一化 Schema 的浅拷贝，减少组件层与运行时 Schema 共享同一顶层对象引用。

## Improvements

- 表单装配拆分为 Model、Runtime、Controller、Observer、Bindings 和 Facade，运行时内部进一步拆分为编译、描述、节点、协调和 View 子系统；包的 `exports` 未新增内部运行时子路径，根入口仍是公共边界。
- 统一泛型参数命名，补充 `SchemxExactBaseField` 等精确类型，并新增 `pnpm run type-test` 覆盖公共类型契约。
- `@schemx/core` 的版本、`exports` 和运行时依赖在本范围内未改变；新增的是用于公共类型契约检查的 `type-test` 脚本。

## Dependencies and Compatibility

- Core 保持框架无关；Standard Schema 可直接由 Core 处理，`async-validator` 等第三方校验器应通过 `ValidationAdapterV1` 接入，或使用配套的 `@schemx/validator` 适配包。
- `@schemx/vue`、`@schemx/vant` 和 `@schemx/validator` 在本范围内同步适配了 Core 的配置、Schema 或校验契约；升级 Core 时应同步检查这些包的版本和导入名称。

## Documentation

- 更新 Core README，补充新的校验结果、命名规则 Registry、Renderer Registry、全局配置、Schema 容器和表单 API 说明。

## Affected Packages

- `@schemx/core`：Schema、表单实例、配置、Registry 和校验公共契约直接变化。
- `@schemx/vue`：依赖新的 Core 配置、Schema 和校验结果/字段错误 API。
- `@schemx/vant`：通过 Vue/Core 导出链继承 Renderer 与表单契约变化。
- `@schemx/validator`：实现并消费新的 Core `ValidationAdapterV1` 与校验结果契约。
