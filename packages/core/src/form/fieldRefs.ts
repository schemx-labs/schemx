/**
 * 表单字段引用，以节点身份和 Store 路径状态维护稳定引用。
 * @module core/form/fieldRefs
 */

import { isFieldNode } from "../node"
import { createReactiveScope, runSignalUntracked } from "../reactivity"

import type { NodeId, NodeManager } from "../node"
import type { Store, StoreState } from "../store"
import type {
  FieldRef,
  FieldRefState,
  FieldValue,
  NamePath,
  SchemxFormApi,
  Values,
} from "../types"

/**
 * 同一 Form 共享的字段引用操作。
 * @typeParam TValues - 表单值类型。
 */
export type FormFieldRefs<TValues extends Values> = Pick<
  SchemxFormApi<TValues>,
  "getFieldRef" | "getFieldName" | "getFieldState"
>

/**
 * 字段引用域的公开投影。
 * @typeParam TValues - 表单值类型。
 */
export interface FormFieldRefsDomain<TValues extends Values> {
  /**
   * 同一 Form 共享的稳定引用操作。
   */
  readonly api: FormFieldRefs<TValues>
}

/**
 * 创建字段引用所需的操作、节点身份和所属表单生命周期。
 * @typeParam TValues - 表单值类型。
 */
export interface CreateFormFieldRefsOptions<TValues extends Values> {
  /**
   * Form 拥有的原始路径状态与读取操作。
   */
  readonly store: Store<TValues>
  /**
   * 字段当前路径与稳定身份的索引。
   */
  readonly nodeManager: NodeManager<TValues>
  /**
   * 表单或节点树是否已销毁。
   */
  isDisposed(): boolean
}

/**
 * 引用绑定初始手动路径或稳定 NodeId，派生状态只由所属 Form 持有。
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 引用初始路径。
 */
interface FieldRefRecord<TValues extends Values, TName extends NamePath<TValues>> {
  /**
   * 手动字段的固定路径，节点字段用于记录初次定位位置。
   */
  readonly name: TName
  /**
   * 已绑定的字段节点身份；手动字段不设置此项。
   */
  readonly nodeId?: NodeId
  /**
   * 当前引用独占的只读状态投影。
   */
  readonly state: FieldRefState<TValues, TName>
}

/**
 * 创建一个 Form 独占的字段引用缓存，不持有完整 Instance 或 Runtime。
 * @typeParam TValues - 表单值类型。
 * @param options - 共享操作、节点身份和销毁状态读取能力。
 * @returns 字段引用、当前地址和只读状态的操作。
 * @example const fieldRefs = createFormFieldRefs({ store, nodeManager, isDisposed })
 */
export function createFormFieldRefs<TValues extends Values>(
  options: CreateFormFieldRefsOptions<TValues>
): FormFieldRefsDomain<TValues> {
  // 字段状态读取与生命周期由 Form 装配，不在引用模块重新创建。
  const { store, nodeManager, isDisposed } = options

  // Schema 字段以节点为键，手动字段以 Store 状态身份为键。
  const fieldRefs = new WeakMap<object, unknown>()

  // 不透明引用对应的初始地址、节点身份和状态。
  const refRecords = new WeakMap<object, unknown>()

  /**
   * 首次通过节点索引定位字段，引用和派生状态由 Form 按身份缓存。
   * @typeParam TName - 初始路径。
   * @param name - 初次定位路径。
   */
  function getFieldRef<TName extends NamePath<TValues>>(
    name: TName
  ): FieldRef<TValues, TName> {
    if (isDisposed()) {
      throw new Error("[schemx] Form has been destroyed.")
    }

    return runSignalUntracked(() => {
      // 路径只在首次定位时解析，后续通过稳定 NodeId 读取当前地址。
      const [nodeId] = nodeManager.getNodeIds(name)

      // 当前路径对应的候选节点，可能是数组根或行。
      const candidate = nodeId === undefined ? undefined : nodeManager.get(nodeId)

      // 没有普通字段 Schema 的路径保持现有手动字段语义。
      const node = isFieldNode(candidate) ? candidate : undefined

      // 手动字段沿用 Store 身份，Schema 字段沿用节点身份。
      const owner = node ?? store.state.field(name)

      // 同一身份始终复用同一个公开引用。
      const cached = fieldRefs.get(owner)

      if (cached) {
        return cached as FieldRef<TValues, TName>
      }

      // 注册后所属 Form 才能识别此对象，引用不暴露内部状态或节点。
      const ref = Object.freeze({}) as FieldRef<TValues, TName>

      // 状态只读取共享 API；销毁信号包含 Form 与节点两个边界。
      const state = createFieldRefState({
        form: {
          getFieldName,
          getFieldValue: store.getFieldValue.bind(store),
          isFieldTouched: store.isFieldTouched.bind(store),
          isFieldPending: store.isFieldPending.bind(store),
        },
        state: store.state,
        ref,
        isDisposed: () => isDisposed() || node?.disposed.value === true,
      })

      refRecords.set(ref, { name, nodeId: node?.id, state })
      fieldRefs.set(owner, ref)

      return ref
    })
  }

  /**
   * 获取引用状态，不触发新的字段定位。
   * @typeParam TName - 引用初始路径。
   * @param ref - 本 Form 的字段引用。
   */
  function getFieldState<TName extends NamePath<TValues>>(
    ref: FieldRef<TValues, TName>
  ): FieldRefState<TValues, TName> {
    // 引用记录同时验证当前对象属于此 Form。
    const record = refRecords.get(ref) as FieldRefRecord<TValues, TName> | undefined

    if (!record) {
      throw new TypeError("[schemx] FieldRef belongs to a different Form or is invalid.")
    }

    return record.state
  }

  /**
   * 读取引用当前地址；终态在每次操作入口检查。
   * @typeParam TName - 引用初始路径。
   * @param ref - 本 Form 的字段引用。
   */
  function getFieldName<TName extends NamePath<TValues>>(
    ref: FieldRef<TValues, TName>
  ): NamePath<TValues> | undefined {
    // 引用记录同时验证当前对象属于此 Form。
    const record = refRecords.get(ref) as FieldRefRecord<TValues, TName> | undefined

    if (!record) {
      throw new TypeError("[schemx] FieldRef belongs to a different Form or is invalid.")
    }

    if (isDisposed() || record.state.disposed.value) {
      return undefined
    }

    return record.nodeId === undefined ? record.name : nodeManager.getPath(record.nodeId)
  }

  return { api: { getFieldRef, getFieldName, getFieldState } }
}

/**
 * Form 字段状态投影所需的引用和生命周期。
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 引用初始路径。
 */
interface CreateFieldRefStateOptions<
  TValues extends Values,
  TName extends NamePath<TValues>,
> {
  readonly form: Pick<
    SchemxFormApi<TValues>,
    "getFieldName" | "getFieldValue" | "isFieldTouched" | "isFieldPending"
  >
  /**
   * 提供固定路径的错误消息缓存。
   */
  readonly state: StoreState<TValues>
  readonly ref: FieldRef<TValues, TName>
  /**
   * 节点或所属 Form 的原生销毁状态。
   */
  isDisposed(): boolean
}

// 空错误消息保持稳定身份。
const EMPTY_ERRORS: readonly string[] = []

/**
 * 投影 Form 的字段读取能力，不重复解析节点身份或管理字段数据。
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 引用初始路径。
 * @param options - Form 读取能力、原生字段状态、引用和生命周期。
 * @example const state = createFieldRefState(options)
 */
function createFieldRefState<TValues extends Values, TName extends NamePath<TValues>>({
  form,
  state,
  ref,
  isDisposed,
}: CreateFieldRefStateOptions<TValues, TName>): FieldRefState<TValues, TName> {
  const scope = createReactiveScope(isDisposed)

  const name = scope.state(() => form.getFieldName(ref))

  const disposed = scope.state(isDisposed)

  const value = scope.state(() => {
    const current = form.getFieldName(ref)

    return current === undefined
      ? undefined
      : (form.getFieldValue(current) as FieldValue<TValues, TName> | undefined)
  })

  // 消息复用 Store 的缓存，避免在节点改名时创建等价的消息数组。
  const errors = scope.state(() => {
    const current = form.getFieldName(ref)

    return current === undefined ? EMPTY_ERRORS : state.field(current).errors.value
  })

  const touched = scope.state(() => {
    const current = form.getFieldName(ref)

    return current !== undefined && form.isFieldTouched(current)
  })

  const pending = scope.state(() => {
    const current = form.getFieldName(ref)

    return current !== undefined && form.isFieldPending(current)
  })

  return { name, disposed, value, errors, touched, pending }
}
