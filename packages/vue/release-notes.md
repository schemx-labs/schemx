# Release Notes — 1.0.0-next.4

## 版本信息

- 目标版本：1.0.0-next.4
- 发布包：@schemx/vue
- 生成日期：2026-09-04
- 基准版本：@schemx/vue@0.2.3
- 比较范围：c9b1d200d09002498b902dd96f8ec84d61cd21fe..0136a0a47d8daee37019ac3e30bfd701c6b27936
- 目标提交：0136a0a
- 当前分支：dev

本预发布版本重构了 Vue 表单组件、Core Bridge 和配置层，新增 Dynamic、ConfigProvider、表单操作区与 Vue 响应式选择器。公共组件名称、规则注册、Effect Hook、配置上下文和字段插槽参数均有不兼容变化。

## Important Notices

- `1.0.0-next.4` 是预发布版本，公共 API 仍可能继续调整。

## Breaking Changes

<a id="change-7675652d636f6d706f6e656e742d656e747279706f696e7473"></a>

### FormItem/FormGroup 更名为 Field/Group

`@schemx/vue` 根入口不再导出 `FormItem` 与 `FormGroup`，改为导出 `Field` 与 `Group`；默认插件静态引用同步使用 `Field`。

影响范围：直接导入旧组件名，或依赖 `SchemxForm.FormItem` 静态属性的项目。

#### 迁移说明

影响范围：根入口、SchemxForm 插件静态属性和组件注册

1. 将 `FormItem` 替换为 `Field`，将 `FormGroup` 替换为 `Group`。
2. 将 `SchemxForm.FormItem` 替换为 `SchemxForm.Field`。
3. 检查自定义组件对旧组件源码路径的直接引用。

替代方案：`Field` 与 `Group`

<a id="change-7675652d72756c652d7265676973747279"></a>

### Vue 规则注册表改用 presetRuleRegistry

`validatorRegistry` 和旧的校验注册导出不再作为 Vue 当前公共入口；命名规则使用 `presetRuleRegistry` / `createPresetRuleRegistry`，第三方校验器使用 `validatorAdapters`。

影响范围：在 Vue 插件、useForm、ConfigProvider 或表单 Props 中传入旧规则注册表的项目。

#### 迁移说明

影响范围：根入口、useForm、SchemxFormProps 和配置 Provider

1. 将 `validatorRegistry` 替换为 `presetRuleRegistry`。
2. 将外部校验库接入移到 `validatorAdapters`。
3. 同步检查 `@schemx/core` 的 `CreateFormOptions` 命名。

替代方案：`presetRuleRegistry` + `validatorAdapters`

<a id="change-7675652d7573652d6566666563742d72656d6f76616c"></a>

### 移除 useEffect Hook

`@schemx/vue` 不再导出 `useEffect`；它原先封装 Core 的旧 `createEffect` 并在组件卸载时释放。

影响范围：直接从 `@schemx/vue` 导入 `useEffect` 的组件。

#### 迁移说明

影响范围：Vue Hooks 根入口

1. 需要 Signal effect 时从 `@schemx/core` 导入 `createSignalEffect`。
2. 将 disposer 交给 Vue 的 `onUnmounted` 或当前 effect scope。
3. 需要按字段、多个字段或全表监听时改用 `useWatch`。

替代方案：`createSignalEffect` + `onUnmounted`，或 `useWatch`

<a id="change-7675652d636f6e6669672d636f6e74657874"></a>

### Form 配置上下文收敛为 schemaConfig

`FormContextProps` 从旧的扁平 Props 映射改为仅包含 `{ schemaConfig }`；`SchemxFormProps` 改为显式组合 Schema、Registry、回调、生命周期和性能配置。

影响范围：自定义 Provider、字段组件或封装层读取旧扁平上下文字段的项目。

#### 迁移说明

影响范围：createFormConfigContext、useFormConfigContext 和 SchemxFormProps

1. 将上下文读取改为 `const { schemaConfig } = useFormConfigContext()`。
2. 通过 `createFormConfigContext({ schemaConfig: { ... } })` 提供默认展示配置。
3. 将字段规则和 Renderer 配置分别放入 `fieldRules` 与 `rendererProps`。

替代方案：`FormContextProps = { schemaConfig }`

<a id="change-7675652d6669656c642d736c6f742d636f6e7472616374"></a>

### 字段插槽参数改为统一 Slot Props

`{name}Label`、`{name}Before`、`{name}Content`、`{name}After`、`{name}Error` 和字段整体插槽现在传入 `schema`、`componentProps`、`value`、`field`、`form`；Content 额外提供 `columnElement`，Error 额外提供 `errors`。

影响范围：依赖旧插槽参数直接展开 ViewSchema 顶层属性的自定义组件。

#### 迁移说明

影响范围：字段区域插槽和自定义字段渲染器

1. 按新的 Slot Props 对象接收插槽参数。
2. 从 `props.schema` 或 `props.componentProps.formItemProps` 读取字段 Schema。
3. Content 使用 `props.columnElement`，Error 使用 `props.errors`。

替代方案：`SchemxFieldSlotProps` 系列类型

<a id="change-7675652d6669656c642d696e7374616e63652d6572726f7273"></a>

### FieldInstance 错误状态改用 errors

Vue 字段实例以只读 `errors: ComputedRef<readonly string[]>` 暴露当前错误；旧的 `error` / 单数错误调用方式不再适用。

影响范围：读取 `FieldInstance.error`、`getError()` 或依赖错误值为 undefined 的组件。

#### 迁移说明

影响范围：useField() 返回值和 Field 插槽上下文

1. 将 `field.error` 改为 `field.errors`，空状态按空数组处理。
2. 将 `getError`、`setError`、`clearError` 改为对应复数方法。
3. 表单级错误改从 `form.getFieldsErrors()` 读取。

替代方案：`FieldInstance.errors` 与复数错误 API

## Features

### @schemx/vue

- <a id="change-7675652d64796e616d69632d72656e6465726572"></a>`SchemxForm` 识别 Core 的 Dynamic ViewSchema，并按数组行渲染 Field、Group 及行内动态子树；字段插槽会继续透传。

- <a id="change-7675652d636f6e6669672d70726f7669646572"></a>新增 `ConfigProvider`，支持在 `app.use(SchemxForm, options)` 和组件树中提供 `schemaConfig`、`rendererProps`、Registry 与 `validatorAdapters`；配置按表单、Provider、App 和模块默认值合并。

- <a id="change-7675652d666f726d2d616374696f6e73"></a>`SchemxForm` 默认提供提交/重置按钮，可通过 `submitter`、`resetter` 配置文本和按钮属性，或用同名插槽替换；`loading` 会统一禁用操作区。

- <a id="change-7675652d666f726d2d627269646765"></a>`useForm()` 返回可在 Vue effect 中追踪字段值、错误、touched、pending 和 loading 的 `VueSchemxInstance`；新增 `useFormSelector()` 将表单快照映射为只读浅引用。

- <a id="change-7675652d67726f75702d6163636573736962696c697479"></a>Group 支持受控 `collapsed`、`onCollapsedChange`、`destroyOnCollapse`、`visible`、`readonly` 和 `disabled`，并输出关联 ID、ARIA 展开状态和键盘切换行为。

## Fixes

### @schemx/vue

- <a id="change-7675652d6d6f64656c2d73796e63"></a>外部 `modelValue` 更新现在通过 `setFieldsValue` 同步到 Core，并抑制同一快照的回写事件；响应式 Schema 和 Dependency 子树更新会复用同一表单实例。

## Improvements

### @schemx/vue

- <a id="change-7675652d64696374696f6e6172792d747970696e67"></a>`SchemxDictionary<TValues, TResponse, TOption>` 将 API 响应与格式化后的选项类型分离，并支持 AbortSignal、重试、依赖变化清理和 shouldFetch。

- <a id="change-7675652d747970652d636865636b2d6275696c64"></a>Vue 包的 `build` 会先运行 `vue-tsc` 和公共类型测试；新增 `vue-tsc` 开发依赖，类型错误会在 Vite 构建前失败。

## Documentation

### @schemx/vue

- <a id="change-7675652d646f63756d656e746174696f6e"></a>Vue README 补充 Field/Group、配置 Provider、Dynamic、字段插槽、字典泛型、Form 操作区和新的规则注册名称。

## API Changes

- [FormItem/FormGroup 更名为 Field/Group](#change-7675652d636f6d706f6e656e742d656e747279706f696e7473)
- [Vue 规则注册表改用 presetRuleRegistry](#change-7675652d72756c652d7265676973747279)
- [移除 useEffect Hook](#change-7675652d7573652d6566666563742d72656d6f76616c)
- [Form 配置上下文收敛为 schemaConfig](#change-7675652d636f6e6669672d636f6e74657874)
- [字段插槽参数改为统一 Slot Props](#change-7675652d6669656c642d736c6f742d636f6e7472616374)
- [FieldInstance 错误状态改用 errors](#change-7675652d6669656c642d696e7374616e63652d6572726f7273)
- [新增 Dynamic 数组渲染组件](#change-7675652d64796e616d69632d72656e6465726572)
- [新增 App 与组件树级 ConfigProvider](#change-7675652d636f6e6669672d70726f7669646572)
- [新增内置提交与重置操作区](#change-7675652d666f726d2d616374696f6e73)
- [新增 Vue 响应式 Form Bridge 与 useFormSelector](#change-7675652d666f726d2d627269646765)
- [增强 Group 折叠与可访问性状态](#change-7675652d67726f75702d6163636573736962696c697479)
- [增强字典请求与选项类型推导](#change-7675652d64696374696f6e6172792d747970696e67)
- [更新 Vue 组件与 Hook 文档](#change-7675652d646f63756d656e746174696f6e)

## TypeScript Changes

- [FormItem/FormGroup 更名为 Field/Group](#change-7675652d636f6d706f6e656e742d656e747279706f696e7473)
- [Vue 规则注册表改用 presetRuleRegistry](#change-7675652d72756c652d7265676973747279)
- [移除 useEffect Hook](#change-7675652d7573652d6566666563742d72656d6f76616c)
- [Form 配置上下文收敛为 schemaConfig](#change-7675652d636f6e6669672d636f6e74657874)
- [字段插槽参数改为统一 Slot Props](#change-7675652d6669656c642d736c6f742d636f6e7472616374)
- [FieldInstance 错误状态改用 errors](#change-7675652d6669656c642d696e7374616e63652d6572726f7273)
- [新增 Vue 响应式 Form Bridge 与 useFormSelector](#change-7675652d666f726d2d627269646765)
- [增强字典请求与选项类型推导](#change-7675652d64696374696f6e6172792d747970696e67)
- [发布构建纳入 Vue 类型契约检查](#change-7675652d747970652d636865636b2d6275696c64)
- [与 Core 适配边界同步](#change-7675652d636f6d70617469626c652d636f7265)

## Dependencies and Compatibility

- <a id="change-7675652d636f6d70617469626c652d636f7265"></a>Vue Bridge 消费 `@schemx/core/adapter` 的快照协议，并依赖 Core 的 SchemxInstance、Schema、配置和校验类型；升级时应与 Core 配套检查。

## Affected Packages

- @schemx/vue
