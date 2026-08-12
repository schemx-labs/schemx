/**
 * 表单组件 Props 类型
 *
 * 定义 schemx 组件及 FormItem 组件的 Props 接口。
 *
 * @module types/form
 */

// 有意保留声明合并能力，以支持框架专属的空扩展接口。
/* eslint-disable @typescript-eslint/no-empty-object-type */

import { DeepNamePath, PathValue } from "./namePathType"
import { SchemxRendererKey } from "./renderer"
import { FieldRules } from "./rule"

import type { SchemxConfigKey } from "../config"
import type { RegistryOptions, ValidationRuleEntry } from "../registry"
import type { SchemxBaseField, SchemxField } from "./schema"
import type { SchemxViewSchema } from "../runtime/view"
import type { StorePending } from "../store"
import type { ValidationResult } from "../validator"

/**
 * 字段值类型。
 *
 * core 不限制具体值形态，校验和渲染器负责解释该值。
 */
export type FieldValue<
  TValues extends Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> = PathValue<TValues, TName>

/**
 * 表单值对象类型。
 *
 * 顶层以字符串 key 索引，嵌套结构由 `NamePath` 和路径工具进一步约束。
 */
export type Values = Record<string, any>

/**
 * 动态属性类型
 *
 * 支持静态值或函数形式，函数接收当前表单值并返回属性值（支持异步）。
 */
export type Dynamic<TValue, TValues extends Values = Values> =
  ((values: TValues) => TValue | Promise<TValue>) | TValue

/**
 * 字段路径类型
 *
 * 支持字符串路径（如 `'user.address.city'`）和类型安全的深层路径推断。
 *
 * @typeParam TValues - 表单值类型，用于路径类型推断
 */
export type NamePath<TValues = Values> = DeepNamePath<TValues>

/**
 * 字段静态 schema patch。
 *
 * 只允许更新不会改变 RuntimeNode 身份和结构的字段级静态呈现配置。
 * `name`、`key`、`componentType`、`dependencies` 这类结构/资源边界字段仍应通过
 * `setSchemas` 或 `updateSchemas` 更新。
 */
export type SchemxFieldSchemaPatch<TValues extends Values = Values> = Partial<
  Omit<SchemxBaseField<TValues>, "name" | "key" | "componentType" | "dependencies">
>

/**
 * 验证规则触发时机
 *
 * 支持两种命名风格：`onBlur` / `blur`，内部会归一化处理。
 */
export type ValidationTrigger =
  "onBlur" | "onChange" | "onSubmit" | "blur" | "change" | "submit"

/**
 * 表单级默认配置。
 *
 * 这些配置会作为 schema 编译和字段呈现态的默认值，字段自身配置优先级更高。
 */
export type SchemxSchemaConfig = Pick<SchemxBaseField, SchemxConfigKey>

/**
 * 已完成内置默认值合并的表单级 Schema 配置。
 *
 * Runtime 内部使用该类型，保证除 `showRequiredMark` 外的配置字段都已具备确定值。
 */
export type ResolvedSchemxSchemaConfig = Omit<
  {
    [TKey in keyof SchemxSchemaConfig]-?: SchemxSchemaConfig[TKey]
  },
  "showRequiredMark"
> & {
  showRequiredMark: boolean | undefined
}

/**
 * 表单实例接口
 *
 * 定义表单的所有操作方法，是 useForm 返回值的基础接口。
 * SchemxInstance 类实现此接口，提供完整的表单操作能力。
 *
 * @typeParam TValues - 表单值类型，默认为 Values
 */
export interface SchemxInstance<TValues extends Values = Values> {
  /**
   * 获取单个字段的当前值
   *
   * 读取响应式值；在 computed/watch 中调用时会自动追踪变化。
   *
   * @param name - 字段路径
   * @returns 字段当前值
   *
   * @example
   * ```typescript
   * const name = form.getFieldValue('name')
   * const city = form.getFieldValue('user.address.city')
   * ```
   */
  getFieldValue<TName extends NamePath<TValues>>(
    name: TName
  ): FieldValue<TValues, TName> | undefined

  /**
   * 获取多个字段值
   *
   * 不传参数返回全部当前值，传入路径数组返回指定字段的值；返回对象是读取结果，
   * 不是写入表单状态的入口。
   *
   * @param names - 可选，要获取的字段路径数组
   * @returns 全量当前值或指定字段的值
   *
   * @example
   * ```typescript
   * const latestValues = form.getFieldsValue()       // Readonly<TValues>
   * const partial = form.getFieldsValue(['name', 'email'])
   * ```
   */
  getFieldsValue: {
    (): TValues
    <TName extends NamePath<TValues>>(names: TName[]): Partial<TValues>
    <TName extends NamePath<TValues>>(names?: TName[]): Partial<TValues>
  }

  /**
   * 设置单个字段值并通知订阅者
   *
   * 支持嵌套路径，如 'user.address.city'。
   *
   * @param name - 字段路径
   * @param value - 字段值
   *
   * @example
   * ```typescript
   * form.setFieldValue('name', 'John')
   * form.setFieldValue('user.address.city', 'Beijing')
   * ```
   */
  setFieldValue<TName extends NamePath<TValues>>(
    name: TName,
    value: FieldValue<TValues, TName> | undefined
  ): void

  /**
   * 批量设置字段值并通知订阅者
   *
   * 一次性更新多个字段，只触发一次通知。
   *
   * @param values - 要设置的字段值对象
   *
   * @example
   * ```typescript
   * form.setFieldsValue({ name: 'John', age: 25 })
   * ```
   */
  setFieldsValue: (values: Partial<TValues>) => void

  /**
   * 获取单个字段值的快照
   *
   * 返回不收集依赖的当前值，适用于需要脱离响应式追踪的场景。
   *
   * @param name - 字段路径
   * @returns 该字段当前值
   *
   * @example
   * ```typescript
   * const name = form.getFieldSnapshot('name') // => 'John'（深拷贝）
   * ```
   */
  getFieldSnapshot<TName extends NamePath<TValues>>(
    name: TName
  ): FieldValue<TValues, TName> | undefined

  /**
   * 获取当前表单值的快照
   *
   * 返回不收集依赖的独立值快照，适用于序列化、提交等场景。
   *
   * @returns 当前表单值组成的新对象
   *
   * @example
   * ```typescript
   * const snapshot = form.getFieldsSnapshot()
   * JSON.stringify(snapshot)
   * ```
   */
  getFieldsSnapshot: {
    (): TValues
    <TName extends NamePath<TValues>>(paths: TName[]): Partial<TValues>
    <TName extends NamePath<TValues>>(paths?: TName[]): Partial<TValues>
  }

  /**
   * 获取表单字段初始值。
   *
   * 不传参返回全量初始值的深拷贝，传入路径返回指定字段的初始值。
   *
   * @param name - 字段路径
   * @returns 全量初始值或指定字段的初始值
   *
   * @example
   * ```typescript
   * form.getInitialValue('name') // => 'John'
   * ```
   */
  getInitialValue<TName extends NamePath<TValues>>(
    name: TName
  ): FieldValue<TValues, TName> | undefined

  /**
   * 获取表单初始值。
   *
   * 不传参返回全量初始值的深拷贝，传入路径返回指定字段的初始值。
   *
   * @param paths - 可选的字段路径数组
   * @returns 全量初始值或指定字段的初始值
   *
   * @example
   * ```typescript
   * form.getInitialValues()         // => { name: 'John', age: 25 }
   * form.getInitialValues(['name']) // => { name: 'John' }
   * ```
   */
  getInitialValues: {
    (): Partial<TValues>
    <TName extends NamePath<TValues>>(paths: TName[]): Partial<TValues>
    <TName extends NamePath<TValues>>(paths?: TName[]): Partial<TValues>
  }

  /**
   * 批量设置多个字段的初始值。
   *
   * @param values - 要设置的字段值对象
   *
   * @example
   * ```typescript
   * form.setInitialValues({ name: 'Bob', age: 30 })
   * ```
   */
  setInitialValues: (values: Partial<TValues>) => void

  /**
   * 检查单个字段是否发生过显式交互。
   *
   * @param name - 字段路径
   * @returns 是否与初始值不同
   *
   * @example
   * ```typescript
   * form.setFieldTouched('name', true)
   * form.isFieldTouched('name') // => true
   * ```
   */
  isFieldTouched<TName extends NamePath<TValues>>(name: TName): boolean

  /**
   * 设置字段交互状态。
   *
   * 传入路径设置字段修改状态。
   *
   * @param name - 字段路径
   * @param value - 值
   *
   * @example
   * ```typescript
   * form.setFieldTouched('name', false)
   * ```
   */
  setFieldTouched<TName extends NamePath<TValues>>(name: TName, value: boolean): void

  /**
   * 获取所有发生过显式交互的字段路径。
   *
   * @returns 被修改的字段路径数组
   *
   * @example
   * ```typescript
   * const touched = form.getTouchedFields()
   * // => ['name', 'user.address.city']
   * ```
   */
  getTouchedFields: () => NamePath<TValues>[]

  /**
   * 设置字段的操作中状态
   *
   * 用于标记字段正在进行异步操作（如文件上传），
   * 校验和提交时会检查是否有字段处于操作中状态。
   *
   * @param name - 字段路径
   * @param pending - 是否处于操作中
   * @param message - 可选的操作中提示信息。
   *
   * @example
   * ```typescript
   * form.setFieldPending('avatar', true)   // 上传开始
   * form.setFieldPending('avatar', false)  // 上传结束
   * ```
   */
  setFieldPending<TName extends NamePath<TValues>>(
    name: TName,
    pending: boolean,
    message?: string | string[]
  ): void

  /**
   * 检查单个字段是否处于操作中
   *
   * 返回响应式值，在 effect 中使用时自动追踪变化。
   *
   * @param name - 字段路径
   * @returns 是否处于操作中
   *
   * @example
   * ```typescript
   * form.isFieldPending('avatar') // => true
   * ```
   */
  isFieldPending<TName extends NamePath<TValues>>(name: TName): boolean

  /**
   * 获取所有处于操作中的字段信息
   *
   * 返回当前所有 pending 状态为 true 的字段路径，无操作中字段时返回空数组。
   *
   * @returns 操作中的字段信息数组，每项包含 field（路径）和 message（提示信息）
   *
   * @example
   * ```typescript
   * form.getPendingFields()
   * // => [{ field: 'avatar' }, { field: 'attachment' }]
   * ```
   */
  getPendingFields: () => StorePending<TValues, NamePath<TValues>>[]

  /**
   * 返回当前是否正在提交表单。
   *
   * 在 `effect()` 中调用时会追踪提交状态变化。
   *
   * @example
   * ```typescript
   * if (form.isLoading()) {
   *   console.log('正在提交')
   * }
   * ```
   */
  isLoading: () => boolean

  /**
   * 重置指定字段到初始值
   *
   * @param names - 要重置的字段路径数组
   *
   * @example
   * ```typescript
   * form.resetFields(['name', 'email'])
   * ```
   */
  resetFields<TName extends NamePath<TValues>>(names: TName[]): void

  /**
   * 重置整个表单到初始值
   *
   * 恢复所有字段到构造时的初始值，并通知订阅者。
   *
   * @example
   * ```typescript
   * form.reset()
   * ```
   */
  reset: () => void

  /**
   * 校验指定字段
   *
   * @param name - 要校验的字段路径
   * @returns 校验结果，成功返回 values，失败返回 errors
   *
   * @example
   * ```typescript
   * const result = await form.validateField('email')
   *
   * if (!result.valid) {
   *   console.log(result.errors)
   * }
   * ```
   */
  validateField<TName extends NamePath<TValues>>(
    names: TName
  ): Promise<ValidationResult<TValues, TName>>

  /**
   * 校验所有已注册字段
   *
   * @returns 校验结果，成功返回 values，失败返回 errors
   *
   * @example
   * ```typescript
   * const result = await form.validate()
   * if (result.valid) {
   *   submitToServer(result.values)
   * }
   * ```
   */
  validate: () => Promise<ValidationResult<TValues>>

  /**
   * 获取单个字段的错误信息快照。
   *
   * @param name - 字段路径
   * @returns 只读错误信息数组，无错误时返回稳定的空数组。
   *
   * @example
   * ```typescript
   * const errors = form.getFieldErrors('email')
   * // => ['邮箱格式错误'] 或 []
   * ```
   */
  getFieldErrors<TName extends NamePath<TValues>>(name: TName): readonly string[]

  /**
   * 手动设置字段的错误信息
   *
   * @param name - 字段路径
   * @param errors - 错误信息数组
   *
   * @example
   * ```typescript
   * form.setFieldErrors('username', ['用户名已存在'])
   * ```
   */
  setFieldErrors<TName extends NamePath<TValues>>(
    name: TName,
    errors: readonly string[]
  ): void

  /**
   * 清除指定字段的全部错误消息。
   *
   * @param name - 要清除错误的字段路径。
   */
  clearFieldErrors<TName extends NamePath<TValues>>(name: TName): void

  /**
   * 提交表单
   *
   * 先等待依赖并校验所有字段，通过后调用 onFinish，失败调用 onFinishFailed。
   * 内置防重复提交锁，提交进行中重复调用返回同一个 Promise。
   *
   * @returns 校验结果。依赖等待超时时返回表单级失败结果，
   * 不调用提交回调；onFinish 抛错或拒绝时，Promise 会直接拒绝。
   *
   * @example
   * ```typescript
   * const result = await form.submit()
   * if (!result.valid) {
   *   console.log(result.errors)
   * }
   * ```
   */
  submit: () => Promise<ValidationResult<TValues>>

  /**
   * 创建 reactive effect 监听字段或错误变化。
   *
   * 回调内调用 getFieldValue/getFieldErrors 时自动追踪依赖，
   * 当依赖的 reactive value 变化时 effect 自动重新执行。
   *
   * @param fn - effect 回调函数
   * @returns 取消 effect 的函数
   *
   * @example
   * ```typescript
   * const dispose = form.effect(() => {
   *   console.log('name:', form.getFieldValue('name'))
   * })
   * // 当 name 字段变化时 effect 自动重新执行
   * dispose() // 取消 effect
   * ```
   */
  effect: (fn: () => void) => () => void

  /**
   * 批量更新字段值，多次 set 合并为一次 effect 触发。
   *
   * @param fn - 批量操作函数
   *
   * @example
   * ```typescript
   * form.batch(() => {
   *   form.setFieldValue('name', 'Bob')
   *   form.setFieldValue('age', 30)
   * })
   * // 依赖 name 或 age 的 effect 只触发一次
   * ```
   */
  batch: (fn: () => void) => void

  /**
   * 替换当前表单的 root schemas。
   *
   * 字段值、错误和 touched 状态由 store/validator 按字段路径保留；
   * 被移除字段的运行时资源会随 RuntimeNode 卸载释放。
   *
   * @param schemas - 下一版 root schema 列表
   */
  setSchemas: (schemas: SchemxField<TValues>[]) => void

  /**
   * 基于当前 root schemas 派生下一版 schemas。
   *
   * @param updater - 接收当前 schemas 并返回下一版 schemas 的函数
   */
  updateSchemas: (
    updater: (schemas: readonly SchemxField<TValues>[]) => readonly SchemxField<TValues>[]
  ) => void

  /**
   * 更新单个字段的静态 schema 呈现配置。
   *
   * 该方法直接定位已有 Field RuntimeNode，只更新字段级 staticSchema，
   * 不重新编译整棵 root schemas。字段身份、结构、渲染器类型和 dependencies
   * 仍由 `setSchemas` / `updateSchemas` 管理。
   *
   * @param name - 目标字段路径
   * @param patch - 要合并到当前字段静态 schema 的呈现配置
   */
  updateFieldSchema: (
    name: NamePath<TValues>,
    patch: SchemxFieldSchemaPatch<TValues>
  ) => void

  /**
   * 更新表单默认配置。
   *
   * 合并传入属性到当前 schemaConfig，然后重新编译根 schemas 并 reconcile。
   * 未设置的字段级属性会回退到这些默认值。
   *
   * @param partial - 要更新的默认配置（部分或全部）
   *
   * @example
   * ```typescript
   * form.updateSchemaConfig({ visible: false, disabled: true })
   * ```
   */
  updateSchemaConfig: (partial: Partial<SchemxSchemaConfig>) => void

  /**
   * 获取当前 ViewSchemas。
   *
   * @returns 当前可渲染的静态 schema 列表。
   */
  getViewSchemas: () => readonly SchemxViewSchema<TValues>[]

  /**
   * 订阅 ViewSchemas 变化。
   *
   * @param callback - ViewSchemas 变化后的回调。
   * @returns 取消订阅函数。
   */
  subscribeViewSchemas: (
    callback: (schemas: readonly SchemxViewSchema<TValues>[]) => void
  ) => () => void

  /**
   * 等待所有异步依赖解析完成
   *
   * @param timeout - 最大等待时间（毫秒），默认 10000
   * @returns true 表示全部完成，false 表示超时
   */
  waitForDependencies: (timeout?: number) => Promise<boolean>

  /**
   * 获取指定类型的渲染器组件
   *
   * 根据类型标识从内部的 RendererRegistry 中查找对应的渲染器组件。
   * 未找到时回退到回退类型，均不存在则返回 undefined。
   *
   * @param type - 渲染器类型标识
   * @returns 对应的渲染器组件，未找到时返回 undefined
   *
   * @example
   * ```typescript
   * const renderer = form.getRenderer('input')
   * if (renderer) {
   *   // 使用渲染器组件
   * }
   * ```
   */
  getRenderer: (type: SchemxRendererKey) => unknown | undefined

  /**
   * 注册渲染器组件
   *
   * 将渲染器组件注册到内部的 RendererRegistry，
   * 后续可通过 getRenderer 获取。
   *
   * @param type - 渲染器类型标识
   * @param renderer - 渲染器组件
   *
   * @example
   * ```typescript
   * form.registerRenderer('input', InputComponent)
   * ```
   */
  registerRenderer: (type: SchemxRendererKey, renderer: unknown) => void

  /**
   * 检查指定类型的渲染器是否已注册
   *
   * @param type - 渲染器类型标识
   * @returns 是否已注册
   *
   * @example
   * ```typescript
   * if (form.hasRenderer('input')) {
   *   // 渲染器已注册
   * }
   * ```
   */
  hasRenderer: (type: SchemxRendererKey) => boolean

  /**
   * 获取指定名称的校验规则条目
   *
   * 返回原始注册条目（原生规则、Standard Schema 或工厂函数），不执行工厂。
   *
   * @param name - 规则名称
   * @returns 对应的规则条目，未找到时返回 undefined。
   *
   * @example
   * ```typescript
   * const entry = form.getRule('phone')
   * ```
   */
  getRule: (name: string) => ValidationRuleEntry | undefined

  /**
   * 注册校验规则
   *
   * 将校验规则注册到当前表单的 ValidationRuleRegistry，
   * 后续可通过 getRule / hasRule 查询。
   *
   * @param name - 规则名称
   * @param rule - StandardSchemaV1 实例或工厂函数
   * @param options - 控制覆盖注册等行为的注册选项。
   *
   * @example
   * ```typescript
   * form.registerRule('phone', phoneRule)
   * ```
   */
  registerRule: (
    name: string,
    rule: ValidationRuleEntry,
    options?: RegistryOptions
  ) => void

  /**
   * 检查指定名称的校验规则是否已注册
   *
   * 支持父级链式查找。
   *
   * @param name - 规则名称
   * @returns 是否已注册
   *
   * @example
   * ```typescript
   * form.hasRule('phone') // => true
   * ```
   */
  hasRule: (name: string) => boolean

  /**
   * 替换字段的全部校验规则。
   *
   * @param name - 字段路径
   * @param rules - 字段校验规则或规则数组。
   *
   * @example
   * ```typescript
   * import { z } from 'zod'
   * form.setFieldRules('email', z.string().email('邮箱格式错误'))
   * ```
   */
  setFieldRules: <TName extends NamePath<TValues>>(
    name: TName,
    rules: FieldRules<TValues, TName>
  ) => void

  /**
   * 移除字段校验规则。
   *
   * 同时清除该字段的错误信息。
   *
   * @param name - 字段路径
   *
   * @example
   * ```typescript
   * form.removeFieldRules('email')
   * ```
   */
  removeFieldRules: <TName extends NamePath<TValues>>(name: TName) => void

  /**
   * 销毁表单实例
   *
   * 清除所有订阅回调，释放资源。通常在组件卸载时调用。
   *
   * @example
   * ```typescript
   * form.destroy()
   * ```
   */
  destroy: () => void
}

/**
 * Schema 通用配置上下文。
 */
export interface SchemxGlobalContext {
  /** 当前生效的全局 Schema 默认配置。 */
  schemaConfig: Partial<SchemxSchemaConfig>
}

/**
 * 表单 API，提供与表单交互的方法。
 *
 * 传递给动态渲染器，允许程序化操作表单。
 *
 * @typeParam TValues - 表单值类型
 */
export interface SchemxFormApi<TValues extends Values = Values> {
  /**
   * 设置字段值。
   *
   * @param name - 字段路径
   * @param value - 新值
   */
  setValue<TName extends NamePath<TValues>>(
    name: TName,
    value: FieldValue<TValues, TName> | undefined
  ): void

  /**
   * 设置多个字段值。
   *
   * @param values - 字段值对象
   */
  setValues(values: Partial<TValues>): void

  /**
   * 获取字段值。
   *
   * @param name - 字段路径
   * @returns 字段当前值；字段不存在时返回 undefined。
   */
  getValue<TName extends NamePath<TValues>>(
    name: TName
  ): FieldValue<TValues, TName> | undefined

  /**
   * 获取多个字段值。
   *
   * @param name - 可选的字段路径数组；不传时返回全部字段值。
   * @returns 字段值快照对象。
   */
  /** 获取当前表单的完整值快照。 */
  getValues(): TValues
  /** 按字段路径返回部分表单值。 */
  getValues<TName extends NamePath<TValues>>(name?: TName[]): Partial<TValues>

  /**
   * 获取当前表单值的快照
   *
   * @param names - 可选的字段路径数组；不传时返回全部字段快照。
   * @returns 当前字段值快照对象。
   */
  getSnapshots<TName extends NamePath<TValues>>(names?: TName[]): Partial<TValues>

  /**
   * 重置指定字段到初始值
   *
   * @param names - 要重置的字段路径数组
   *
   * @example
   * ```typescript
   * form.resetFields(['name', 'email'])
   * ```
   */
  resetFields<TName extends NamePath<TValues>>(names: TName[]): void

  /**
   * 重置整个表单到初始值
   *
   * 恢复所有字段到构造时的初始值，并通知订阅者。
   */
  reset: () => void

  /**
   * 设置字段的操作中状态
   *
   * 用于标记字段正在进行异步操作（如文件上传），
   * 校验和提交时会检查是否有字段处于操作中状态。
   *
   * @param name - 字段路径
   * @param pending - 是否处于操作中
   */
  setPending<TName extends NamePath<TValues>>(name: TName, pending: boolean): void

  /**
   * 检查单个字段是否处于操作中
   *
   * 返回响应式值，在 effect 中使用时自动追踪变化。
   *
   * @param name - 字段路径
   * @returns 是否处于操作中
   *
   */
  isPending<TName extends NamePath<TValues>>(name: TName): boolean

  /**
   * 设置字段是否已被触摸。
   *
   * @param name - 字段路径
   * @param value - 值
   */
  setTouched<TName extends NamePath<TValues>>(name: TName, value: boolean): void

  /**
   * 检查字段是否已被触摸。
   *
   * @param name - 字段路径
   * @returns 是否已被触摸
   */
  isTouched<TName extends NamePath<TValues>>(name: TName): boolean

  /**
   * 校验单个字段。
   *
   * @param name - 字段路径
   * @returns 校验结果
   */
  validateField<TName extends NamePath<TValues>>(
    name: TName
  ): Promise<ValidationResult<TValues, TName>>

  /**
   * 校验所有字段。
   *
   * @returns 校验结果
   */
  validate(): Promise<ValidationResult<TValues>>

  /**
   * 设置字段是否有错误。
   *
   * @param name - 字段路径
   * @param errors - 错误信息数组
   */
  setErrors<TName extends NamePath<TValues>>(name: TName, errors: readonly string[]): void

  /**
   * 获取字段错误列表。
   *
   * @param name - 字段路径
   * @returns 错误消息的只读快照。
   */
  getErrors<TName extends NamePath<TValues>>(name: TName): readonly string[]

  /**
   * 清除字段错误列表。
   *
   * @param name - 字段路径。
   */
  clearErrors<TName extends NamePath<TValues>>(name: TName): void
}
