/**
 * createField - 框架无关的单字段控制器
 *
 * 将 SchemxInstance 的方法作用域限定到指定字段，
 * 提供单字段的读写、校验、状态订阅等能力。
 * 框架适配层（Vue / React）可通过 `effect` 桥接各自的响应式系统。
 *
 * @module core/createField
 *
 * @example
 * ```ts
 * import { createField, createForm } from '@schemx/core'
 *
 * const form = createForm({ initialValues: { name: '', avatar: '' } })
 * const field = createField(form, 'name')
 *
 * field.setValue('John')
 * field.getValue() // => 'John'
 *
 * const dispose = field.effect(() => {
 *   console.log('value:', field.getValue())
 *   console.log('errors:', field.getErrors())
 * })
 *
 * dispose() // 取消订阅
 * ```
 */

import { createReactiveScope, runSignalUntracked } from "./reactivity"
import { createValidationCancelled } from "./validator"

import type { ReadonlySignal, ReadonlyState } from "./reactivity"
import type { FieldNode } from "./runtime/node"
import type { FieldState } from "./store"
import type {
  FieldRules,
  FieldValue,
  NamePath,
  SchemxBaseField,
  SchemxInstance,
  Values,
} from "./types"
import type { ValidationResult } from "./validator"

/**
 * 字段控制器共享的原生状态；值类型由初次路径推导，name 表示当前实际地址。
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 初始定位路径。
 */
export interface SchemxFieldState<
  TValues extends Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> extends FieldState<TValues, TName> {
  /**
   * 当前绑定路径；失效后为 undefined。
   */
  readonly name: ReadonlyState<NamePath<TValues> | undefined>
  /**
   * 绑定节点或所属 Form 是否已销毁。
   */
  readonly disposed: ReadonlyState<boolean>
}

/**
 * 单字段控制器接口
 *
 * 封装 SchemxInstance 中与单个字段相关的所有操作，
 * 以及基于 reactive effect 的状态订阅能力。
 *
 * @typeParam TValues - 表单值类型
 * @typeParam TName - 初始定位路径，用于推导字段值类型
 */
export interface SchemxFieldInstance<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  /**
   * 稳定的字段状态；Schema 字段跟随节点，手动字段复用 Store 的固定路径来源。
   */
  readonly state: SchemxFieldState<TValues, TName>
  /**
   * 获取当前字段值。
   *
   * @returns 当前字段值；字段不存在时返回 undefined。
   */
  getValue(): FieldValue<TValues, TName> | undefined

  /**
   * 程序赋值，不改变 touched 或触发交互回调、自动校验。
   *
   * @param value - 新字段值。
   */
  setValue(value: FieldValue<TValues, TName> | undefined): void

  /**
   * 提交用户修改，由 Core 处理可操作状态、touched、Schema 回调和校验触发。
   *
   * @param value - 控件转换后的字段值。
   * @returns 自动校验结果；未触发校验或交互被忽略时返回 undefined。
   */
  change(
    value: FieldValue<TValues, TName> | undefined
  ): Promise<ValidationResult<TValues> | undefined>

  /**
   * 提交用户失焦，由 Core 标记 touched、执行 Schema 回调并按配置校验。
   *
   * @returns 自动校验结果；未触发校验或交互被忽略时返回 undefined。
   */
  blur(): Promise<ValidationResult<TValues> | undefined>

  /**
   * 获取字段初始值。
   *
   * @returns 当前字段的初始值；未设置时返回 undefined。
   */
  getInitialValue(): FieldValue<TValues, TName> | undefined

  /**
   * 设置字段初始值。
   *
   * @param value - 新初始值。
   */
  setInitialValue(value: FieldValue<TValues, TName>): void

  /**
   * 获取表单当前值。
   *
   * 在 effect 中调用时，读取过程会自动追踪字段变化。
   *
   * @returns 当前表单值的独立副本，修改副本不会更新表单。
   */
  getValues(): TValues

  /**
   * 获取当前字段值快照。
   *
   * @returns 当前字段值快照；字段失效时返回 undefined。
   */
  getSnapshot(): FieldValue<TValues, TName> | undefined

  /**
   * 获取表单全量快照。
   *
   * @returns 当前表单值快照。
   */
  getSnapshots(): TValues

  /**
   * 获取当前字段错误信息。
   *
   * @returns 错误信息的只读快照；没有错误时返回空数组。
   */
  getErrors(): readonly string[]

  /**
   * 设置当前字段错误信息。
   *
   * @param errors - 用于替换当前错误状态的消息数组。
   */
  setErrors(errors: readonly string[]): void

  /**
   * 清除当前字段错误信息。
   */
  clearErrors(): void

  /**
   * 设置字段实例规则；绑定节点时规则随节点移动，手动字段时按路径保存。
   * Form.setFieldRules 的显式路径覆盖保持优先。
   *
   * @param rules - 校验规则或规则数组。
   *
   * @example
   * ```ts
   * field.setRules({
   *   validate: (value) => value
   *     ? { valid: true }
   *     : { valid: false, issues: [{ message: "不能为空" }] },
   * })
   * ```
   */
  setRules(rules: FieldRules<TValues, TName>): void

  /**
   * 注销当前字段校验规则。
   */
  removeRules(): void

  /**
   * 设置字段交互状态。
   *
   * @param value - 当前字段是否已被触摸。
   */
  setTouched(value: boolean): void

  /**
   * 检查当前字段是否已被触摸。
   *
   * @returns 是否已被触摸。
   */
  isTouched(): boolean

  /**
   * 设置当前字段操作中状态。
   *
   * @param pending - 是否处于操作中。
   * @param message - 可选的操作中提示信息。
   */
  setPending(pending: boolean, message?: string | string[]): void

  /**
   * 检查当前字段是否处于操作中。
   *
   * @returns 是否处于操作中。
   */
  isPending(): boolean

  /**
   * 重置当前字段到初始值。
   */
  reset(): void

  /**
   * 校验当前字段。
   *
   * @returns 当前字段校验结果。
   */
  validate(): Promise<ValidationResult<TValues>>

  /**
   * 创建 reactive effect
   *
   * 在字段生命周期中订阅，在回调中访问 getValue / getErrors / isPending 时
   * 自动追踪对应 reactive 依赖，依赖变化时 effect 自动重新执行。
   *
   * @param fn - effect 回调函数
   * @returns dispose 函数，取消 effect
   *
   * @example
   * ```ts
   * const dispose = field.effect(() => {
   *   console.log('value:', field.getValue())
   * })
   * dispose()
   * ```
   */
  effect(fn: () => void): () => void
}

/**
 * 用初始路径定位字段并绑定节点身份；没有 Schema 节点时保持手动路径绑定。
 *
 * 委托给 form.createField，返回包含读写、校验、状态订阅等能力的控制器。
 *
 * @typeParam TValues - 表单值类型
 * @typeParam TName - 初始定位路径，用于推导字段值类型
 *
 * @param form - 表单实例
 * @param name - 初始定位路径；建立绑定后不会重新查找同名替换节点。
 * @returns Form 持有的稳定字段控制器。同一节点改名时应保持字段值类型。
 * @throws Form 已经销毁时抛出错误。
 *
 * @example
 * ```ts
 * const field = createField(form, 'username')
 *
 * field.setValue('John')
 * field.getValue() // => 'John'
 *
 * const dispose = field.effect(() => {
 *   console.log(field.getValue())
 * })
 * ```
 */
export function createField<
  TValues extends Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(form: SchemxInstance<TValues>, name: TName): SchemxFieldInstance<TValues, TName> {
  return form.createField(name)
}

/**
 * 创建同一套字段操作所需的初始定位与生命周期配置。
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 初始定位路径，用于维持字段值类型。
 */
export interface CreateFieldControllerOptions<
  TValues extends Values,
  TName extends NamePath<TValues>,
> {
  /**
   * 当前 Core 表单。
   */
  readonly form: SchemxInstance<TValues>
  /**
   * 初次定位路径。
   */
  readonly name: TName
  /**
   * 已存在时绑定此节点；缺省表示固定的手动字段。
   */
  readonly node?: FieldNode<TValues>
  /**
   * Form 的响应式销毁状态。
   */
  readonly disposed: ReadonlySignal<boolean>
  /**
   * 检查 Runtime 是否仍可操作，覆盖 Form 开始销毁的生命周期回调。
   */
  isActive(): boolean
}

// 失效控制器复用空错误列表。
const EMPTY_ERRORS: readonly string[] = []

/**
 * 创建统一字段控制器，所有操作在调用时解析绑定的当前路径。
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 初始定位路径；同一节点更新配置时应保持字段值类型。
 * @param options - Form、初次路径、可选节点和生命周期配置。
 * @example const field = createFieldController(options)
 */
export function createFieldController<
  TValues extends Values,
  TName extends NamePath<TValues>,
>(
  options: CreateFieldControllerOptions<TValues, TName>
): SchemxFieldInstance<TValues, TName> {
  // Form 与节点身份在创建时绑定，当前路径仍在每次操作时读取。
  const { form, name, node } = options

  // 终态由所属 Form 或绑定节点决定，路径暂时不可操作不等于销毁。
  const isDisposed = (): boolean =>
    options.disposed.value || node?.disposed.value === true

  // 字段订阅随绑定节点或所属 Form 的销毁状态终止。
  const scope = createReactiveScope(isDisposed)

  // TName 描述初始字段的值类型；节点改名只改变当前地址。
  const getName = (): TName | undefined => {
    if (isDisposed() || !options.isActive()) {
      return undefined
    }

    // 节点改名保持字段值类型；断言恢复初始路径与值类型的对应关系。
    return node ? (node.name.value as TName) : name
  }

  // 写操作不将路径解析时读取的状态加入调用方的响应式依赖。
  const readName = (): TName | undefined => runSignalUntracked(getName)

  // 读取值时保留路径与字段值的依赖追踪。
  const getValue: SchemxFieldInstance<TValues, TName>["getValue"] = () => {
    const current = getName()

    return current === undefined ? undefined : form.getFieldValue(current)
  }

  // 触摸状态读取跟随节点当前路径。
  const isTouched: SchemxFieldInstance<TValues, TName>["isTouched"] = () => {
    const current = getName()

    return current !== undefined && form.isFieldTouched(current)
  }

  // pending 来源保持为业务字段状态，与表单提交 loading 无关。
  const isPending: SchemxFieldInstance<TValues, TName>["isPending"] = () => {
    const current = getName()

    return current !== undefined && form.isFieldPending(current)
  }

  // 手动字段直接复用 Store 来源；节点字段通过原生 computed 跟随当前地址。
  const pathState = node ? undefined : form.state.field(name)

  // 先创建路径和终态派生值，保持状态的初始化顺序。
  const nameState = scope.state<NamePath<TValues> | undefined>(getName)

  // 终态由节点和 Form 的原生销毁信号派生。
  const disposedState = scope.state(isDisposed)

  // 读取手动字段的稳定状态，或复用节点字段的值读取逻辑。
  const valueState = pathState?.value ?? scope.state(getValue)

  // 原生状态保留结构化问题，公开 getErrors 另外返回消息数组。
  const errorsState =
    pathState?.errors ??
    scope.state(() => {
      const current = getName()

      return current === undefined ? EMPTY_ERRORS : form.state.field(current).errors.value
    })

  // 节点字段的触摸状态跟随当前地址，手动字段保持固定来源。
  const touchedState = pathState?.touched ?? scope.state(isTouched)

  // pending 使用相同的绑定策略。
  const pendingState = pathState?.pending ?? scope.state(isPending)

  // 状态对象只组合已创建的原生只读状态。
  const state: SchemxFieldState<TValues, TName> = {
    name: nameState,
    disposed: disposedState,
    value: valueState,
    errors: errorsState,
    touched: touchedState,
    pending: pendingState,
  }

  // 程序赋值继续经过公开 Form 方法，保留调用方的拦截点。
  const setValue: SchemxFieldInstance<TValues, TName>["setValue"] = (value) => {
    const current = readName()

    if (current !== undefined) {
      form.setFieldValue(current, () => value)
    }
  }

  // 用户修改由 Form 统一处理交互状态、业务回调和自动校验。
  const change: SchemxFieldInstance<TValues, TName>["change"] = (value) => {
    const current = readName()

    if (current === undefined) {
      return Promise.resolve(undefined)
    }

    return form.changeField(current, value)
  }

  // 已失效的字段忽略交互，不再查找同名替换节点。
  const blur: SchemxFieldInstance<TValues, TName>["blur"] = () => {
    const current = readName()

    if (current === undefined) {
      return Promise.resolve(undefined)
    }

    return form.blurField(current)
  }

  // 显式校验对失效绑定返回取消结果。
  const validate: SchemxFieldInstance<TValues, TName>["validate"] = () => {
    const current = readName()

    if (current === undefined) {
      return Promise.resolve(createValidationCancelled(form.getFieldsSnapshot()))
    }

    return form.validateField(current)
  }

  // 初始值读取保持响应式路径追踪。
  const getInitialValue: SchemxFieldInstance<TValues, TName>["getInitialValue"] = () => {
    const current = getName()

    return current === undefined ? undefined : form.getInitialValue(current)
  }

  // 包装写入函数，避免函数类型的字段值被 Store 当成 updater 执行。
  const setInitialValue: SchemxFieldInstance<TValues, TName>["setInitialValue"] = (
    value
  ) => {
    const current = readName()

    if (current !== undefined) {
      form.setInitialValue(current, () => value)
    }
  }

  // 表单级读取不受单字段绑定失效影响。
  const getValues: SchemxFieldInstance<TValues, TName>["getValues"] = () =>
    form.getFieldsValue()

  // 快照读取不建立路径响应式依赖。
  const getSnapshot: SchemxFieldInstance<TValues, TName>["getSnapshot"] = () => {
    const current = readName()

    return current === undefined ? undefined : form.getFieldSnapshot(current)
  }

  // 全量快照始终委托当前 Form。
  const getSnapshots: SchemxFieldInstance<TValues, TName>["getSnapshots"] = () =>
    form.getFieldsSnapshot()

  // 公开错误读取保留消息数组契约。
  const getErrors: SchemxFieldInstance<TValues, TName>["getErrors"] = () => {
    const current = getName()

    return current === undefined ? EMPTY_ERRORS : form.getFieldErrors(current)
  }

  // 错误写入交由 Form 转换为结构化问题。
  const setErrors: SchemxFieldInstance<TValues, TName>["setErrors"] = (errors) => {
    const current = readName()

    if (current !== undefined) {
      form.setFieldErrors(current, errors)
    }
  }

  // 仅清除当前绑定路径的错误。
  const clearErrors: SchemxFieldInstance<TValues, TName>["clearErrors"] = () => {
    const current = readName()

    if (current !== undefined) {
      form.clearFieldErrors(current)
    }
  }

  // 节点覆盖随身份移动，手动字段规则仍按固定路径保存。
  const setRules: SchemxFieldInstance<TValues, TName>["setRules"] = (rules) => {
    const current = readName()

    if (current === undefined) {
      return
    }

    if (node) {
      // 节点保持初始字段值类型，规则数组复制后交由节点持有。
      node.rulesOverride.value = (
        Array.isArray(rules) ? [...rules] : [rules]
      ) as SchemxBaseField<TValues>["rules"]

      return
    }

    form.setFieldRules(current, rules)
  }

  // 节点绑定只撤销节点覆盖；手动绑定撤销固定路径覆盖。
  const removeRules: SchemxFieldInstance<TValues, TName>["removeRules"] = () => {
    const current = readName()

    if (current === undefined) {
      return
    }

    if (node) {
      node.rulesOverride.value = undefined

      return
    }

    form.removeFieldRules(current)
  }

  // 写入状态时使用当前路径，但不建立调用方依赖。
  const setTouched: SchemxFieldInstance<TValues, TName>["setTouched"] = (touched) => {
    const current = readName()

    if (current !== undefined) {
      form.setFieldTouched(current, touched)
    }
  }

  // 业务 pending 和提示信息统一委托 Form。
  const setPending: SchemxFieldInstance<TValues, TName>["setPending"] = (
    pending,
    message
  ) => {
    const current = readName()

    if (current !== undefined) {
      form.setFieldPending(current, pending, message)
    }
  }

  // 保留字段级重置语义，不触发完整表单重置回调。
  const reset: SchemxFieldInstance<TValues, TName>["reset"] = () => {
    const current = readName()

    if (current !== undefined) {
      form.resetFields([current])
    }
  }

  // 路径失效后不再执行业务订阅，清理由响应式生命周期管理。
  const effect: SchemxFieldInstance<TValues, TName>["effect"] = (run) =>
    scope.effect(() => {
      if (getName() !== undefined) {
        run()
      }
    })

  return {
    state,
    getValue,
    setValue,
    change,
    blur,
    validate,
    getInitialValue,
    setInitialValue,
    getValues,
    getSnapshot,
    getSnapshots,
    getErrors,
    setErrors,
    clearErrors,
    setRules,
    removeRules,
    setTouched,
    isTouched,
    setPending,
    isPending,
    reset,
    effect,
  }
}
