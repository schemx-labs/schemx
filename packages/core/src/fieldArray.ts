/**
 * FieldArray - 框架无关的动态数组字段控制器。
 *
 * FieldArray 只管理数组结构和稳定渲染 key；数组项内部字段仍然通过普通
 * NamePath（例如 `users.0.name`）访问。数组项值不从 `getFields()` 暴露，
 * 避免 Vue/React 列表状态与 Store 值状态产生第二份可变快照。
 *
 * @module core/fieldArray
 */

import type { FieldValue, NamePath, Values } from "./types"

/**
 * 从数组字段值中提取单行类型。
 *
 * @typeParam TValue - 需要解析的字段值类型。
 */
export type FieldArrayItemValue<TValue> = TValue extends null | undefined
  ? never
  : TValue extends readonly (infer TItem)[]
    ? TItem
    : never

// 将对象属性追加到当前字段路径。
type JoinFieldArrayPath<TPrefix extends string, TKey extends string> = TPrefix extends ""
  ? TKey
  : `${TPrefix}.${TKey}`

// 判断类型中是否包含数组成员，用于继续递归查找候选路径。
type HasArrayMember<TValue> =
  Extract<NonNullable<TValue>, readonly unknown[]> extends never ? false : true

// 只接受长度可变的数组，排除 tuple 和固定长度数组。
type IsDynamicArray<TValue> = [NonNullable<TValue>] extends [readonly unknown[]]
  ? number extends NonNullable<TValue>["length"]
    ? true
    : false
  : false

/**
 * 递归提取不经过数组索引的动态数组路径。
 *
 * 递归深度限制为 5 层，避免复杂表单类型导致类型计算失控。
 */
type FieldArrayPathInner<
  TValue,
  TPrefix extends string = "",
  TDepth extends unknown[] = [],
> = TDepth["length"] extends 5
  ? never
  : HasArrayMember<TValue> extends true
    ? IsDynamicArray<TValue> extends true
      ? TPrefix
      : never
    : [NonNullable<TValue>] extends [object]
      ? {
          [TKey in keyof NonNullable<TValue> & string]: FieldArrayPathInner<
            NonNullable<NonNullable<TValue>[TKey]>,
            JoinFieldArrayPath<TPrefix, TKey>,
            [...TDepth, 1]
          >
        }[keyof NonNullable<TValue> & string]
      : never

/**
 * 仅允许指向动态数组值的字段路径。
 *
 * @typeParam TValues - 表单值类型。
 */
export type FieldArrayPath<TValues extends Values> = Extract<
  FieldArrayPathInner<TValues>,
  NamePath<TValues>
>

/**
 * FieldArray 的行结构。
 *
 * `key` 只用于渲染稳定身份，不会写入表单值。
 */
export interface FieldArrayField {
  /**
   * 用于 Vue/React 列表渲染的稳定身份。
   */
  readonly key: string
  /**
   * 当前数组索引；结构变化后由 Store 重新计算。
   */
  readonly index: number
}

/**
 * FieldArray 结构变更影响的索引范围。
 *
 * `start` 和 `end` 均为包含边界，空范围不会出现在变更描述中。
 */
export interface FieldArrayRange {
  /**
   * 受影响范围的起始索引，包含该索引。
   */
  readonly start: number
  /**
   * 受影响范围的结束索引，包含该索引。
   */
  readonly end: number
}

/**
 * FieldArray 一次原子提交的结构变更描述。
 *
 * 该描述同时供 Store 清理受影响的字段状态和校验层失效旧结果使用。
 */
export interface FieldArrayChange {
  /**
   * 结构提交前的数组长度。
   */
  readonly previousLength: number
  /**
   * 结构提交后的数组长度。
   */
  readonly nextLength: number
  /**
   * 需要清理字段状态或校验结果的包含边界索引范围。
   */
  readonly ranges: readonly FieldArrayRange[]
  /**
   * 根数组 replace/reset 是否必须重新生成全部 key。
   */
  readonly resetKeys?: boolean
}

/**
 * 已绑定数组路径的 Store 内部能力。
 *
 * Handle 不负责决定 batch 边界；调用方应使用 FormModel 提供的 batch 包裹
 * `commit`，以便值、结构和校验失效在同一批次内完成。
 *
 * @typeParam TItem - 数组单行类型。
 */
export interface FieldArrayHandle<TItem> {
  /**
   * 注册数组根路径并初始化结构 key；重复调用必须保持幂等。
   */
  register(): void
  /**
   * 读取数组根值；未初始化或 nullish 值由控制器视为空数组。
   */
  getValue(): readonly TItem[] | null | undefined
  /**
   * 读取只包含 key 的结构 Signal；不会订阅数组项值。
   */
  getStructure(): readonly string[]
  /**
   * 为新行生成由 Form 统一管理的 key。
   *
   * @param count - 需要生成的 key 数量。
   */
  createKeys(count: number): readonly string[]
  /**
   * 提交值、key 和结构影响范围。
   *
   * @param value - 提交后的数组值。
   * @param keys - 与 value 长度一致的稳定行 key。
   * @param change - 本次结构变化及受影响范围。
   */
  commit(value: readonly TItem[], keys: readonly string[], change: FieldArrayChange): void
  /**
   * 监听结构提交，并返回取消监听函数。
   *
   * @param listener - 接收当前路径结构变化的回调。
   */
  subscribe(listener: (change: FieldArrayChange) => void): () => void
}

/**
 * FieldArray 的框架无关控制器。
 *
 * 控制器只管理数组结构和稳定 key；数组项字段值仍由 Store 按普通路径管理。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TPath - 当前动态数组字段路径。
 */
export interface FieldArrayInstance<
  TValues extends Values,
  TPath extends FieldArrayPath<TValues>,
> {
  /**
   * 数组字段路径。
   */
  readonly name: TPath
  /**
   * 当前数组行结构；读取只依赖结构 key，不订阅行值。
   */
  getFields(): readonly FieldArrayField[]
  /**
   * 在数组末尾追加一行。
   *
   * @param value - 新行值。
   */
  append(value: FieldArrayItemValue<FieldValue<TValues, TPath>>): void
  /**
   * 在数组末尾追加多行。
   *
   * @param values - 要追加的新行值。
   */
  appendMany(values: readonly FieldArrayItemValue<FieldValue<TValues, TPath>>[]): void
  /**
   * 在数组头部插入一行。
   *
   * @param value - 新行值。
   */
  prepend(value: FieldArrayItemValue<FieldValue<TValues, TPath>>): void
  /**
   * 在数组头部插入多行。
   *
   * @param values - 要插入的新行值。
   */
  prependMany(values: readonly FieldArrayItemValue<FieldValue<TValues, TPath>>[]): void
  /**
   * 在指定索引前插入一行。
   *
   * @param index - 插入位置，允许取 0 到当前长度。
   * @param value - 新行值。
   * @throws 当 index 不是整数或超出插入边界时抛出 RangeError。
   */
  insert(index: number, value: FieldArrayItemValue<FieldValue<TValues, TPath>>): void
  /**
   * 在指定索引前插入多行。
   *
   * @param index - 插入位置，允许取 0 到当前长度。
   * @param values - 要插入的新行值。
   * @throws 当 index 不是整数或超出插入边界时抛出 RangeError。
   */
  insertMany(
    index: number,
    values: readonly FieldArrayItemValue<FieldValue<TValues, TPath>>[]
  ): void
  /**
   * 删除指定索引，或删除多个索引。
   *
   * @param index - 要删除的行索引；重复索引只处理一次。
   * @throws 当任一索引不是整数或超出当前数组范围时抛出 RangeError。
   */
  remove(index: number | readonly number[]): void
  /**
   * 替换指定索引的行值并保留该行 key。
   *
   * @param index - 要更新的行索引。
   * @param value - 新行值。
   * @throws 当 index 不是整数或超出当前数组范围时抛出 RangeError。
   */
  update(index: number, value: FieldArrayItemValue<FieldValue<TValues, TPath>>): void
  /**
   * 替换整个数组，并为新数组生成新的行 key。
   *
   * @param value - 替换后的完整数组值。
   */
  replace(value: readonly FieldArrayItemValue<FieldValue<TValues, TPath>>[]): void
  /**
   * 交换两个行的位置并保留两行各自的 key。
   *
   * @param from - 源行索引。
   * @param to - 目标行索引。
   * @throws 当任一索引不是整数或超出当前数组范围时抛出 RangeError。
   */
  swap(from: number, to: number): void
  /**
   * 将一行移动到新的索引并保留该行 key。
   *
   * @param from - 源行索引。
   * @param to - 目标行索引。
   * @throws 当任一索引不是整数或超出当前数组范围时抛出 RangeError。
   */
  move(from: number, to: number): void
}

/**
 * 创建内部 FieldArray 控制器。
 *
 * @param handle - 提供当前数组路径值和结构操作的 Handle。
 * @param name - 动态数组字段路径。
 * @param batch - 将一次数组操作包裹为原子更新的批处理函数。
 * @typeParam TValues - 表单值类型。
 * @typeParam TPath - 动态数组字段路径类型。
 * @returns 可执行数组结构操作的控制器。
 * @throws 当数组值、索引或 Store 结构状态不满足约束时抛出错误。
 *
 * @example
 * ```ts
 * const users = createFieldArrayController(store.getFieldArrayHandle("users"), "users", batch)
 * users.append({ name: "Alice" })
 * ```
 */
export function createFieldArrayController<
  TValues extends Values,
  TPath extends FieldArrayPath<TValues>,
>(
  handle: FieldArrayHandle<FieldArrayItemValue<FieldValue<TValues, TPath>>>,
  name: TPath,
  batch: (fn: () => void) => void
): FieldArrayInstance<TValues, TPath> {
  handle.register()

  type TItem = FieldArrayItemValue<FieldValue<TValues, TPath>>

  // 读取当前数组并复制一层，避免结构操作直接修改 Store 快照。
  const readItems = (): TItem[] => {
    const value = handle.getValue()

    if (value == null) {
      return []
    }

    if (!Array.isArray(value)) {
      throw new TypeError(
        `[schemx] FieldArray field "${String(name)}" must contain an array.`
      )
    }

    return [...value]
  }

  /**
   * 读取当前行 key，并校验值与结构长度一致。
   *
   * @param length - 当前数组值的行数。
   * @throws 当 Store 中的 key 数量与数组长度不一致时抛出错误。
   */
  const readKeys = (length: number): string[] => {
    const keys = [...handle.getStructure()]

    if (keys.length !== length) {
      throw new Error(
        `[schemx] FieldArray field "${String(name)}" has inconsistent structure state.`
      )
    }

    return keys
  }

  /**
   * 创建一个包含边界的受影响索引范围。
   *
   * @param start - 受影响范围起始索引。
   * @param end - 受影响范围结束索引。
   * @returns 起止顺序无效时返回空范围，否则返回单个范围。
   */
  const createRange = (start: number, end: number): FieldArrayRange[] => {
    if (start > end) {
      return []
    }

    return [{ start, end }]
  }

  /**
   * 生成结构变化描述，并在同一批次提交数组值和 key。
   *
   * @param previousLength - 提交前的数组长度。
   * @param items - 提交后的数组值。
   * @param keys - 提交后的稳定行 key。
   * @param ranges - 需要清理状态和校验结果的索引范围。
   * @param resetKeys - 是否将本次操作视为完整 key 重建。
   */
  const commit = (
    previousLength: number,
    items: readonly TItem[],
    keys: readonly string[],
    ranges: readonly FieldArrayRange[],
    resetKeys = false
  ): void => {
    const change: FieldArrayChange = {
      previousLength,
      nextLength: items.length,
      ranges,
      resetKeys,
    }

    batch(() => {
      handle.commit(items, keys, change)
    })
  }

  /**
   * 校验索引是否为整数。
   *
   * @param index - 待校验的数组索引。
   * @throws 当索引不是整数时抛出 RangeError。
   */
  const assertInteger = (index: number): void => {
    if (!Number.isInteger(index)) {
      throw new RangeError(
        `[schemx] FieldArray index must be an integer, received ${index}.`
      )
    }
  }

  /**
   * 校验可插入位置是否落在数组边界内。
   *
   * @param index - 待校验的插入位置。
   * @param length - 当前数组长度。
   * @throws 当位置不在 0 到 length 范围内时抛出 RangeError。
   */
  const assertInsertIndex = (index: number, length: number): void => {
    assertInteger(index)

    if (index < 0 || index > length) {
      throw new RangeError(
        `[schemx] FieldArray index ${index} is out of range for length ${length}.`
      )
    }
  }

  /**
   * 校验已存在行的索引。
   *
   * @param index - 待校验的行索引。
   * @param length - 当前数组长度。
   * @throws 当位置不在 0 到 length - 1 范围内时抛出 RangeError。
   */
  const assertIndex = (index: number, length: number): void => {
    assertInteger(index)

    if (index < 0 || index >= length) {
      throw new RangeError(
        `[schemx] FieldArray index ${index} is out of range for length ${length}.`
      )
    }
  }

  /**
   * 在数组末尾追加多行并只为新增行创建 key。
   *
   * @param values - 要追加的新行值。
   */
  const appendMany = (values: readonly TItem[]): void => {
    const items = readItems()

    const keys = readKeys(items.length)

    const additions = [...values]

    if (additions.length === 0) {
      return
    }

    commit(
      items.length,
      [...items, ...additions],
      [...keys, ...handle.createKeys(additions.length)],
      createRange(items.length, items.length + additions.length - 1)
    )
  }

  /**
   * 在数组头部插入多行，并将既有 key 向后移动。
   *
   * @param values - 要插入的新行值。
   */
  const prependMany = (values: readonly TItem[]): void => {
    const items = readItems()

    const keys = readKeys(items.length)

    const additions = [...values]

    if (additions.length === 0) {
      return
    }

    commit(
      items.length,
      [...additions, ...items],
      [...handle.createKeys(additions.length), ...keys],
      createRange(0, items.length + additions.length - 1)
    )
  }

  /**
   * 在指定位置插入多行，并保留未受影响行的 key。
   *
   * @param index - 插入位置。
   * @param values - 要插入的新行值。
   */
  const insertMany = (index: number, values: readonly TItem[]): void => {
    const items = readItems()

    const keys = readKeys(items.length)

    const additions = [...values]

    assertInsertIndex(index, items.length)

    if (additions.length === 0) {
      return
    }

    commit(
      items.length,
      [...items.slice(0, index), ...additions, ...items.slice(index)],
      [
        ...keys.slice(0, index),
        ...handle.createKeys(additions.length),
        ...keys.slice(index),
      ],
      createRange(index, items.length + additions.length - 1)
    )
  }

  /**
   * 删除一行或多行，并按升序合并受影响索引范围。
   *
   * @param index - 要删除的单个索引或索引列表。
   */
  const remove = (index: number | readonly number[]): void => {
    const items = readItems()

    const keys = readKeys(items.length)

    const indexes = [...(Array.isArray(index) ? index : [index])]

    if (indexes.length === 0) {
      return
    }

    indexes.forEach((itemIndex) => assertIndex(itemIndex, items.length))

    const uniqueIndexes = [...new Set(indexes)].sort((a, b) => a - b)

    const removed = new Set(uniqueIndexes)

    const firstRemovedIndex = uniqueIndexes[0]

    if (firstRemovedIndex === undefined) {
      return
    }

    commit(
      items.length,
      items.filter((_, itemIndex) => !removed.has(itemIndex)),
      keys.filter((_, itemIndex) => !removed.has(itemIndex)),
      createRange(firstRemovedIndex, items.length - 1)
    )
  }

  /**
   * 更新单行值并保留该行 key。
   *
   * @param index - 要更新的行索引。
   * @param value - 新行值。
   */
  const update = (index: number, value: TItem): void => {
    const items = readItems()

    const keys = readKeys(items.length)

    assertIndex(index, items.length)
    items[index] = value
    commit(items.length, items, keys, [])
  }

  /**
   * 替换完整数组并重新生成所有行 key。
   *
   * @param value - 替换后的数组值。
   */
  const replace = (value: readonly TItem[]): void => {
    const previousLength = readItems().length

    const items = [...value]

    commit(
      previousLength,
      items,
      handle.createKeys(items.length),
      createRange(0, Math.max(previousLength, items.length) - 1),
      true
    )
  }

  /**
   * 交换两行的值和 key，并只标记两个索引受影响。
   *
   * @param from - 源行索引。
   * @param to - 目标行索引。
   */
  const swap = (from: number, to: number): void => {
    const items = readItems()

    const keys = readKeys(items.length)

    assertIndex(from, items.length)
    assertIndex(to, items.length)

    if (from === to) {
      return
    }

    const fromItems = items.splice(from, 1)

    const toIndex = to > from ? to - 1 : to

    const toItems = items.splice(toIndex, 1)

    items.splice(from, 0, ...toItems)
    items.splice(to, 0, ...fromItems)

    const fromKeys = keys.splice(from, 1)

    const toKeys = keys.splice(toIndex, 1)

    keys.splice(from, 0, ...toKeys)
    keys.splice(to, 0, ...fromKeys)

    commit(items.length, items, keys, [
      { start: from, end: from },
      { start: to, end: to },
    ])
  }

  /**
   * 移动一行的值和 key，并标记源目标之间的连续范围。
   *
   * @param from - 源行索引。
   * @param to - 目标行索引。
   */
  const move = (from: number, to: number): void => {
    const items = readItems()

    const keys = readKeys(items.length)

    assertIndex(from, items.length)
    assertIndex(to, items.length)

    if (from === to) {
      return
    }

    const movedItems = items.splice(from, 1)

    const movedKeys = keys.splice(from, 1)

    items.splice(to, 0, ...movedItems)
    keys.splice(to, 0, ...movedKeys)

    commit(items.length, items, keys, [
      { start: Math.min(from, to), end: Math.max(from, to) },
    ])
  }

  // 将 Store 的结构 key 投影为渲染层所需的行结构。
  const getFields = (): readonly FieldArrayField[] =>
    handle.getStructure().map((key, index) => ({ key, index }))

  /**
   * 追加单行值。
   *
   * @param value - 要追加的新行值。
   */
  const append = (value: TItem): void => {
    appendMany([value])
  }

  /**
   * 插入单行到数组头部。
   *
   * @param value - 要插入的新行值。
   */
  const prepend = (value: TItem): void => {
    prependMany([value])
  }

  /**
   * 在指定位置插入单行。
   *
   * @param index - 插入位置。
   * @param value - 要插入的新行值。
   */
  const insert = (index: number, value: TItem): void => {
    insertMany(index, [value])
  }

  return {
    name,
    getFields,
    append,
    appendMany,
    prepend,
    prependMany,
    insert,
    insertMany,
    remove,
    update,
    replace,
    swap,
    move,
  }
}
