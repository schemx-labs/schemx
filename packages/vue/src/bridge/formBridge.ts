/**
 * Core Form 到 Vue 响应式状态的共享 Runtime。
 *
 * 每个 Core Form 只有一个稳定 Runtime 和一个 Vue Instance；响应式资源按
 * Vue owner 激活和释放，调用方只持有 Runtime，不再经过快照适配器。
 *
 * @module vue/bridge/formBridge
 */

import { getCurrentScope, onScopeDispose } from "vue"

import {
  createVueFormInstance,
  createVueStateBridge,
  createVueViewSchemaState,
} from "./index"

import type {
  VueBoundFieldState,
  VueFieldDependency,
  VueFormDependency,
  VueFormResources,
  VueFormRuntime,
  VueStateRef,
} from "./index"
import type {
  NamePath,
  ReadonlyState,
  SchemxFieldInstance,
  SchemxInstance,
  Values,
} from "@schemx/core"

/**
 * 原始 Core Form 与 Vue Instance 共用同一个 Runtime 缓存项。
 */
const runtimeCache = new WeakMap<object, VueFormRuntime<Values>>()

/**
 * 在当前 Vue effect scope 中获取共享 Runtime。
 *
 * 每次调用都会为当前 scope 保留一个 Runtime owner，并在 scope 停止时自动
 * 释放该 owner；最后一个 owner 释放后，字段和表单级响应式资源才会回收。
 *
 * @typeParam TValues - 表单值类型。
 * @param form - 要桥接或复用 Runtime 的表单实例。
 * @returns 当前 Form 对应的共享 Runtime。
 * @throws 当前没有活动的 Vue effect scope 时抛出错误。
 *
 * @example
 * ```ts
 * // 在 setup() 或其他活动的 Vue effect scope 中调用。
 * const runtime = useVueFormRuntime(form)
 * const values = runtime.getValuesRef()
 * ```
 */
export function useVueFormRuntime<TValues extends Values = Values>(
  form: SchemxInstance<TValues>
): VueFormRuntime<TValues> {
  if (!getCurrentScope()) {
    throw new Error("[schemx] useVueFormRuntime() requires an active Vue scope.")
  }

  // 本次获取单独计为一个 owner，由当前 scope 负责释放。
  const { runtime, release } = acquireVueFormRuntime(form)

  onScopeDispose(release)

  return runtime
}

/**
 * 获取并保留指定 Form 的共享 Runtime。
 *
 * 调用方负责在 owner 结束时调用 release，可绑定 Vue scope 或在 finally 中释放。
 * 最后一个 owner 释放后只销毁响应式资源，Core Form、Runtime 和 Instance 身份保持不变。
 *
 * @typeParam TValues - 表单值类型。
 * @param form - 要桥接或复用 Runtime 的表单实例。
 * @returns 共享 Runtime 及与当前 owner 对应的释放函数。
 *
 * @example
 * ```ts
 * const { runtime, release } = acquireVueFormRuntime(form)
 * try {
 *   runtime.getValuesRef()
 * } finally {
 *   release()
 * }
 * ```
 */
export function acquireVueFormRuntime<TValues extends Values = Values>(
  form: SchemxInstance<TValues>
): {
  /**
   * 与输入 Form 共用身份的 Runtime。
   */
  runtime: VueFormRuntime<TValues>
  /**
   * 仅释放本次获取的 owner，可重复调用。
   */
  release: () => void
} {
  // 查找稳定外壳，不在缓存中区分原始实例与 Vue 实例。
  const runtime = getOrCreateVueFormRuntime(form)

  // 为本次调用激活资源并取得独立的释放凭据。
  const release = runtime.retain()

  return {
    runtime,
    release,
  }
}

/**
 * 获取已有 Runtime，或为输入的 Core Form 创建 Runtime。
 *
 * 原始实例和桥接后的响应式实例都会映射到同一个 Runtime，避免同一表单因
 * 不同入口重复创建状态订阅。
 *
 * @param form - 要查找或创建 Runtime 的 Form Instance。
 */
function getOrCreateVueFormRuntime<TValues extends Values>(
  form: SchemxInstance<TValues>
): VueFormRuntime<TValues> {
  // 缓存擦除了值类型；命中时由输入 Form 的泛型恢复对应契约。
  const cachedByCore = runtimeCache.get(form as object)

  if (cachedByCore) {
    return cachedByCore as VueFormRuntime<TValues>
  }

  // 仅首次访问创建外壳，后续资源重建不更换实例身份。
  const runtime = createVueFormRuntime(form)

  runtimeCache.set(form as object, runtime as VueFormRuntime<Values>)
  runtimeCache.set(runtime.instance as object, runtime as VueFormRuntime<Values>)

  return runtime
}

/**
 * 创建单个 Core Form 的稳定 Runtime。
 *
 * Runtime 本身保持稳定；retain 或状态获取方法按需创建 Vue 响应式资源。
 * 最后一个 owner 释放时回收当前资源，永久销毁后则不能重建。
 *
 * @param core - 要桥接的 Core Form。
 */
function createVueFormRuntime<TValues extends Values>(
  core: SchemxInstance<TValues>
): VueFormRuntime<TValues> {
  // 当前资源周期的投影；最后一个 owner 释放后清空，允许下次重新创建。
  let resources: VueFormResources<TValues> | undefined

  // 统计尚未释放的获取次数，而非组件或 Form 的数量。
  let ownerCount = 0

  // Runtime 销毁后不可重建资源，与暂时没有 owner 区分。
  let destroyed = false

  // 激活共享缓存，具体状态首次读取时才订阅；永久销毁后不能重新激活。
  const ensureResources = (): VueFormResources<TValues> => {
    if (destroyed) {
      throw new Error("[schemx] Vue Form Runtime has been destroyed.")
    }

    resources ??= { states: createVueStateBridge() }

    return resources
  }

  // 仅回收当前响应式资源，不销毁 Core Form 或稳定实例外壳。
  const disposeResources = (): void => {
    // 先保存待释放资源，避免后续重建与本次清理混用。
    const currentResources = resources

    if (!currentResources) {
      return
    }

    resources = undefined
    currentResources.viewSchemaState?.dispose()
    currentResources.states.dispose()
  }

  // 激活资源并记录本次 owner；返回的释放函数只减少一次计数。
  const retain = (): (() => void) => {
    if (destroyed) {
      return () => {}
    }

    ensureResources()
    ownerCount++

    // 同一 owner 重复清理时不能影响其他 owner 的资源。
    let released = false

    return () => {
      if (released || destroyed) {
        return
      }

      released = true
      ownerCount--

      if (ownerCount === 0) {
        disposeResources()
      }
    }
  }

  /**
   * 通过固定路径的状态 Ref 建立 Vue 依赖，不因读取而重新激活已释放资源。
   * @param name - 当前查询的字段路径。
   * @param dependency - 本次读取对应的字段状态种类。
   */
  const trackField = <TName extends NamePath<TValues>>(
    name: TName,
    dependency: VueFieldDependency
  ): void => {
    if (!resources) {
      return
    }

    // 仅在只读追踪边界擦除值类型，不向原生状态写入数据。
    const state = core.state.field(name)[dependency] as ReadonlyState<unknown>

    void resources.states.bind(state).value
  }

  /**
   * 按查询范围建立依赖，局部查询不订阅整表值。
   * @param names - 要追踪的路径；省略时追踪整表，空数组不建立字段依赖。
   */
  const trackFieldsValue = (names?: NamePath<TValues>[]): void => {
    if (!resources) {
      return
    }

    if (names === undefined) {
      void resources.states.bind(core.state.values).value

      return
    }

    // 各路径复用状态桥接缓存，重复查询不增加 Core 订阅。
    for (const name of names) {
      void resources.states.bind(core.state.field(name).value).value
    }
  }

  /**
   * 通过聚合 Ref 建立 Vue 依赖，不在无 owner 时重新激活资源。
   * @param dependency - 当前查询的表单级状态种类。
   */
  const trackForm = (dependency: VueFormDependency): void => {
    if (!resources) {
      return
    }

    // 与字段追踪相同，只读订阅无需向外暴露联合状态的值类型。
    const state = core.state[dependency] as ReadonlyState<unknown>

    void resources.states.bind(state).value
  }

  // 返回本周期共享的整表值引用，供 selector 等消费者订阅。
  const getValuesRef = (): VueStateRef<TValues> => {
    return ensureResources().states.bind(core.state.values)
  }

  /**
   * 查询当前占用该路径的字段，不绑定历史节点身份。
   * @param name - 当前要查询的字段路径。
   */
  const getFieldState = <TName extends NamePath<TValues>>(name: TName) => {
    return ensureResources().states.field(core.state.field(name))
  }

  /**
   * 字段 Hook 按控制器身份读取；Form 方法继续按路径读取。
   * @typeParam TName - 控制器的初始路径。
   * @param field - Core 缓存的字段控制器。
   */
  const getBoundFieldState = <TName extends NamePath<TValues>>(
    field: SchemxFieldInstance<TValues, TName>
  ): VueBoundFieldState<TValues, TName> => ensureResources().states.field(field.state)

  // 首次消费 Schema 时才订阅视图列表，同周期的调用共用列表和索引。
  const getViewSchemaState = () => {
    // ViewSchema 订阅与原生状态投影归同一资源周期回收。
    const currentResources = ensureResources()

    // 创建后保存到资源对象中，后续读取不重复订阅。
    const viewSchemaState = (currentResources.viewSchemaState ??=
      createVueViewSchemaState(core))

    return viewSchemaState
  }

  // 永久关闭桥接并使尚未调用的 owner 释放函数失效；Core 由 Instance 销毁。
  const destroy = (): void => {
    if (destroyed) {
      return
    }

    destroyed = true
    ownerCount = 0
    disposeResources()
  }

  // 包装读取与销毁动作，其余 Core 方法保持原始引用。
  const instance = createVueFormInstance(core, {
    trackField,
    trackFieldsValue,
    trackForm,
    destroy,
  })

  // 仅组装稳定外壳；可重建资源由上面的闭包持有。
  const runtime: VueFormRuntime<TValues> = {
    core,
    instance,
    retain,
    trackField,
    trackFieldsValue,
    trackForm,
    getValuesRef,
    getFieldState,
    getBoundFieldState,
    getViewSchemaState,
    destroy,
  }

  return runtime
}
