import { runSignalUntracked } from "../../reactivity"
import { getFormStateAdapterContext } from "../formStateAdapter/context"

import type { FormAdapter } from "./types"
import type { ReadonlySignal, ReadonlyState } from "../../reactivity"
import type { FieldState } from "../../store"
import type { DeepReadonly, NamePath, SchemxInstance, Values } from "../../types"
import type { SchemxViewSchema } from "../../view"
import type { FormStateAdapterContext } from "../formStateAdapter/context"

// 只缓存稳定入口，不缓存状态副本、订阅列表或框架容器。
const adapters = new WeakMap<object, unknown>()

// 终态读取保持引用稳定，供外部状态订阅框架比较快照。
const emptyViewSchemas: readonly never[] = []

/**
 * 获取 Form 的原生只读状态入口，所有通知直接来自现有 Signal。
 * 获取入口和读取状态不建立订阅；每个消费者自行订阅和取消，Form 销毁时统一停止。
 * 框架副本与原始实例按内部上下文复用入口；不创建字段控制器或框架容器。
 * @typeParam TValues - 表单值类型。
 * @param form - Core Form 或保留 Core 上下文的框架副本。
 * @example
 * const adapter = getFormAdapter(form)
 * const stop = adapter.values.subscribe(values => console.log(values))
 * stop()
 */
export function getFormAdapter<TValues extends Values>(
  form: SchemxInstance<TValues>
): FormAdapter<TValues> {
  // 原始实例与框架副本共享上下文，底层读取不经过框架包装方法。
  const context = getFormStateAdapterContext(form)

  // 同一上下文唯一确定表单值类型，断言仅恢复弱缓存中的泛型。
  const cached = adapters.get(context)

  if (cached) {
    return cached as FormAdapter<TValues>
  }

  /**
   * 返回固定路径的原生状态，后续节点移动不改变读取目标。
   * @typeParam TName - 要读取的字段路径。
   * @param name - 本次访问的字段路径。
   * @example const state = adapter.field("name")
   */
  function field<TName extends NamePath<TValues>>(
    name: TName
  ): FieldState<TValues, TName> {
    if (context.disposed.peek()) {
      throw new Error("[schemx] Form has been destroyed.")
    }

    return context.store.state.field(name)
  }

  // Signal 只补充无写权限、方法可独立传递的门面，不创建额外 computed。
  const loading = createSignalState(context.loading, context)

  // 终态仍使用原生 Signal，订阅由 Form.effect 所属作用域回收。
  const disposed = createSignalState(context.disposed, context)

  // 视图读取和通知都复用原有入口，保留防抖与首值通知。
  const viewSchemas = createViewState(context)

  // 直接返回已存在的状态，不引入第二份业务数据或监听器分发层。
  const adapter: FormAdapter<TValues> = {
    form: context.form,
    values: context.store.state.values,
    touchedFields: context.store.state.touchedFields,
    pendingFields: context.store.state.pendingFields,
    config: context.configuration.state,
    loading,
    disposed,
    viewSchemas,
    field,
  }

  adapters.set(context, adapter)

  return adapter
}

/**
 * 直接读取已有 Signal，订阅借用 Form.effect 的自动释放，无额外状态或分发器。
 * @typeParam TValue - Signal 内容类型。
 * @typeParam TValues - 所属表单值类型。
 * @param signal - Form 已持有的原生 Signal。
 * @param context - 负责订阅生命周期的原始 Form 上下文。
 */
function createSignalState<TValue, TValues extends Values>(
  signal: ReadonlySignal<TValue>,
  context: FormStateAdapterContext<TValues>
): ReadonlyState<TValue> {
  // 直接读取原生 Signal，Core effect 仍能收集依赖。
  const read = (): DeepReadonly<TValue> => signal.value as DeepReadonly<TValue>

  // 无依赖读取，同一原生状态值保持相同引用。
  const peek = (): DeepReadonly<TValue> => signal.peek() as DeepReadonly<TValue>

  /**
   * 每次订阅直接建立一个原生 effect，首次同步交付当前值。
   * @param listener - 消费原生当前值的框架回调。
   */
  const subscribe = (listener: (value: DeepReadonly<TValue>) => void): (() => void) => {
    if (context.disposed.peek()) {
      return () => {}
    }

    return context.form.effect(() => {
      // 监听器只接收值，内部读取不会污染原生 effect 的依赖。
      const value = read()

      runSignalUntracked(() => listener(value))
    })
  }

  // getter 不允许赋值；peek 与 subscribe 均不依赖 this。
  return Object.defineProperty({ peek, subscribe }, "value", {
    enumerable: true,
    get: read,
  }) as ReadonlyState<TValue>
}

/**
 * 为现有 ViewSchema 入口提供原生只读状态形态，不缓存第二份视图或通知。
 * @typeParam TValues - 表单值类型。
 * @param context - 原始 Form 与原生终态，避免调用框架包装方法。
 */
function createViewState<TValues extends Values>(
  context: FormStateAdapterContext<TValues>
): ReadonlyState<readonly SchemxViewSchema<TValues>[]> {
  // 视图中的组件、回调和业务对象沿用不可变输入约定，不复制或递归代理。
  const read = (): DeepReadonly<readonly SchemxViewSchema<TValues>[]> => {
    if (context.disposed.value) {
      return emptyViewSchemas
    }

    return context.form.getViewSchemas() as DeepReadonly<
      readonly SchemxViewSchema<TValues>[]
    >
  }

  // 与 value 读取同一视图，只跳过 Core 依赖收集。
  const peek = (): DeepReadonly<readonly SchemxViewSchema<TValues>[]> =>
    runSignalUntracked(read)

  /**
   * 委托现有视图订阅，防抖与 Form 生命周期仍由原始入口处理。
   * @param listener - 消费当前完整视图的框架回调。
   */
  const subscribe = (
    listener: (value: DeepReadonly<readonly SchemxViewSchema<TValues>[]>) => void
  ): (() => void) =>
    // schemas 是原始入口交付的当前视图，不重新读取或保存另一份状态。
    context.form.subscribeViewSchemas((schemas) => {
      runSignalUntracked(() =>
        listener(schemas as DeepReadonly<readonly SchemxViewSchema<TValues>[]>)
      )
    })

  // 所有读取都委托原始视图，不增加响应式派生层。
  return Object.defineProperty({ peek, subscribe }, "value", {
    enumerable: true,
    get: read,
  }) as ReadonlyState<readonly SchemxViewSchema<TValues>[]>
}
