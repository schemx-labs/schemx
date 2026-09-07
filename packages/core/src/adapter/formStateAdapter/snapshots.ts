/**
 * Form 状态适配器的快照读取与比较工具。
 *
 * @module core/adapter/formStateAdapter/snapshots
 */

import { createFieldKey } from "../../utils"

import type { FieldStateSnapshot } from "./types"
import type { StorePending } from "../../store"
import type { NamePath, SchemxInstance, Values } from "../../types"

/**
 * 读取并按规范化路径顺序返回 touched 字段快照。
 *
 * @param form - 要读取的 Core Form。
 * @returns 按字段 key 排序的新数组。
 *
 * @example
 * ```ts
 * const touchedFields = getTouchedFieldsSnapshot(form)
 * ```
 */
export function getTouchedFieldsSnapshot<TValues extends Values>(
  form: SchemxInstance<TValues>
): readonly NamePath<TValues>[] {
  return [...form.getTouchedFields()].sort(compareNamePaths)
}

/**
 * 比较两份 touched 字段快照。
 *
 * @param previous - 上一次读取的 touched 字段快照。
 * @param next - 本次读取的 touched 字段快照。
 * @returns 两份快照包含相同字段且顺序一致时返回 `true`。
 *
 * @example
 * ```ts
 * const changed = !areTouchedFieldsEqual(previous, next)
 * ```
 */
export function areTouchedFieldsEqual<TValues extends Values>(
  previous: readonly NamePath<TValues>[],
  next: readonly NamePath<TValues>[]
): boolean {
  if (previous.length !== next.length) {
    return false
  }

  return previous.every(
    (field, index) => createFieldKey(field) === createFieldKey(next[index])
  )
}

/**
 * 读取 pending 字段，并复制每条记录的消息数组。
 *
 * @param form - 要读取的 Core Form。
 * @returns 按字段 key 排序且不复用内部消息数组的 pending 快照。
 *
 * @example
 * ```ts
 * const pendingFields = getPendingFieldsSnapshot(form)
 * ```
 */
export function getPendingFieldsSnapshot<TValues extends Values>(
  form: SchemxInstance<TValues>
): readonly StorePending<TValues, NamePath<TValues>>[] {
  return form
    .getPendingFields()
    .map((entry) => ({ field: entry.field, message: [...entry.message] }))
    .sort((previous, next) => compareNamePaths(previous.field, next.field))
}

/**
 * 比较两份 pending 字段快照。
 *
 * @param previous - 上一次读取的 pending 字段快照。
 * @param next - 本次读取的 pending 字段快照。
 * @returns 字段路径和消息列表都相同时返回 `true`。
 *
 * @example
 * ```ts
 * const changed = !arePendingFieldsEqual(previous, next)
 * ```
 */
export function arePendingFieldsEqual<TValues extends Values>(
  previous: readonly StorePending<TValues, NamePath<TValues>>[],
  next: readonly StorePending<TValues, NamePath<TValues>>[]
): boolean {
  if (previous.length !== next.length) {
    return false
  }

  return previous.every((entry, index) => {
    const nextEntry = next[index]

    return (
      createFieldKey(entry.field) === createFieldKey(nextEntry.field) &&
      areStringListsEqual(entry.message, nextEntry.message)
    )
  })
}

/**
 * 读取一个字段的完整聚合状态。
 *
 * @typeParam TValues - 所属 Form 的值类型。
 * @typeParam TName - 字段路径类型。
 * @param form - 要读取的 Core Form。
 * @param name - 要读取的字段路径。
 * @returns 字段值、错误、touched 和 pending 状态组成的快照。
 *
 * @example
 * ```ts
 * const snapshot = getFieldStateSnapshot(form, "name")
 * ```
 */
export function getFieldStateSnapshot<
  TValues extends Values,
  TName extends NamePath<TValues>,
>(form: SchemxInstance<TValues>, name: TName): FieldStateSnapshot<TValues, TName> {
  return {
    value: form.getFieldValue(name),
    errors: form.getFieldErrors(name),
    touched: form.isFieldTouched(name),
    pending: form.isFieldPending(name),
  }
}

/**
 * 比较字段状态快照。
 *
 * @typeParam TValues - 所属 Form 的值类型。
 * @typeParam TName - 字段路径类型。
 * @param previous - 上一次读取的字段状态快照。
 * @param next - 本次读取的字段状态快照。
 * @returns 字段值、错误、touched 和 pending 都未变化时返回 `true`。
 *
 * @example
 * ```ts
 * const changed = !areFieldStateSnapshotsEqual(previous, next)
 * ```
 */
export function areFieldStateSnapshotsEqual<
  TValues extends Values,
  TName extends NamePath<TValues>,
>(
  previous: FieldStateSnapshot<TValues, TName>,
  next: FieldStateSnapshot<TValues, TName>
): boolean {
  return (
    Object.is(previous.value, next.value) &&
    previous.touched === next.touched &&
    previous.pending === next.pending &&
    areStringListsEqual(previous.errors, next.errors)
  )
}

/**
 * 按规范化字段 key 比较两个字段路径。
 *
 * @typeParam TValues - 所属 Form 的值类型。
 * @param previous - 待比较的第一个字段路径。
 * @param next - 待比较的第二个字段路径。
 * @returns 可直接用于数组排序的比较结果。
 */
function compareNamePaths<TValues extends Values>(
  previous: NamePath<TValues>,
  next: NamePath<TValues>
): number {
  return createFieldKey(previous).localeCompare(createFieldKey(next))
}

/**
 * 按顺序比较两份字符串列表。
 *
 * @param previous - 上一次读取的字符串列表。
 * @param next - 本次读取的字符串列表。
 * @returns 两份列表长度和每项内容都相同时返回 `true`。
 */
function areStringListsEqual(
  previous: readonly string[],
  next: readonly string[]
): boolean {
  if (previous.length !== next.length) {
    return false
  }

  return previous.every((message, index) => message === next[index])
}
