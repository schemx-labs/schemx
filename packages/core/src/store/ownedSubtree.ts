/**
 * 管理字段与 FieldArray 对值子树的 owner 归属和路径解析。
 */
import {
  areOverlappingFieldPaths,
  createFieldKey,
  isDescendantFieldPath,
  normalizeNamePath,
  toNamePathSegments,
} from "../utils"

import type { NamePath, Values } from "../types"
import type { FieldKey } from "../utils/path"

/**
 * 描述值子树 owner 的具体种类。
 */
export type OwnedSubtreeKind = "field" | "fieldArray"

/**
 * 保存普通字段与 FieldArray 共用的 owner 身份。
 */
export interface OwnedSubtree<TValues extends Values> {
  /**
   * 标识该 owner 是普通字段还是数组根。
   */
  readonly kind: OwnedSubtreeKind
  /**
   * owner 持有的根路径。
   */
  readonly path: NamePath<TValues>
  /**
   * 用于 Map 索引和路径比较的稳定 key。
   */
  readonly key: FieldKey
}

/**
 * 描述字段路径解析到最近 owner 后的相对位置。
 */
export interface ResolvedOwnedPath<TValues extends Values> {
  /**
   * 解析得到的最近 owner。
   */
  readonly owner: OwnedSubtree<TValues>
  /**
   * 指定路径是否就是 owner 根路径。
   */
  readonly isRoot: boolean
  /**
   * 从 owner 根开始计算的相对路径。
   */
  readonly relativePath: NamePath<TValues>
}

/**
 * 描述普通字段注册在校验阶段和提交阶段之间的计划。
 */
export interface FieldRegistrationPlan<TValues extends Values> {
  /**
   * 指示无需处理、只需实体化后代 Signal 或创建 owner。
   */
  readonly action: "noop" | "materializeDescendant" | "create"
  /**
   * 待注册的字段路径。
   */
  readonly path: NamePath<TValues>
  /**
   * 待注册路径的稳定 key。
   */
  readonly key: FieldKey
  /**
   * 当路径位于现有 owner 下时提供解析结果。
   */
  readonly resolved?: ResolvedOwnedPath<TValues>
}

/**
 * 描述 FieldArray 注册以及普通后代 owner 吸收结果的计划。
 */
export interface FieldArrayRegistrationPlan<TValues extends Values> {
  /**
   * 指示复用已有数组 owner 或创建新的数组 owner。
   */
  readonly action: "reuse" | "create"
  /**
   * 待注册的数组根路径。
   */
  readonly path: NamePath<TValues>
  /**
   * 待注册路径的稳定 key。
   */
  readonly key: FieldKey
  /**
   * 创建数组 owner 时需要移除的普通后代 owner key。
   */
  readonly absorbedKeys: readonly FieldKey[]
}

/**
 * 维护 owner 注册表，并集中执行路径重叠与吸收规则。
 */
class OwnedSubtreeRegistryImpl<TValues extends Values> {
  /**
   * 按稳定路径 key 保存当前 owner。
   */
  private readonly owners = new Map<FieldKey, OwnedSubtree<TValues>>()

  /**
   * 将路径解析到最近的 owner。
   *
   * @param path 要解析的字段或数组路径。
   * @returns 最近 owner 及相对路径；路径不属于任何 owner 时返回 `undefined`。
   */
  resolve(path: NamePath<TValues>): ResolvedOwnedPath<TValues> | undefined {
    const segments = toNamePathSegments(path)

    for (let depth = segments.length; depth > 0; depth -= 1) {
      const ownerPath = segments.slice(0, depth) as NamePath<TValues>

      const owner = this.owners.get(createFieldKey(ownerPath))

      if (owner) {
        return {
          owner,
          isRoot: depth === segments.length,
          relativePath: segments.slice(depth) as NamePath<TValues>,
        }
      }
    }

    return undefined
  }

  /**
   * 查找指定路径上的 exact owner。
   *
   * @param path 要查找的 owner 根路径。
   */
  get(path: NamePath<TValues>): OwnedSubtree<TValues> | undefined {
    return this.owners.get(createFieldKey(path))
  }

  /**
   * 返回当前 owner 的稳定快照，供批量操作遍历。
   */
  list(): readonly OwnedSubtree<TValues>[] {
    return [...this.owners.values()]
  }

  /**
   * 判断指定路径是否已有 exact owner。
   *
   * @param path 要检查的 owner 根路径。
   */
  has(path: NamePath<TValues>): boolean {
    return this.owners.has(createFieldKey(path))
  }

  /**
   * 校验普通字段注册，并延迟实际写入 owner 表。
   *
   * @param path 要注册的普通字段路径。
   * @returns 可在后续批处理阶段提交的注册计划。
   * @throws 当路径与不兼容的 owner 发生重叠时抛出错误。
   */
  prepareFieldRegistration<TName extends NamePath<TValues>>(
    path: TName
  ): FieldRegistrationPlan<TValues> {
    const key = createFieldKey(path)

    const resolved = this.resolve(path)

    if (resolved?.owner.kind === "fieldArray") {
      return {
        action: resolved.isRoot ? "noop" : "materializeDescendant",
        path,
        key,
        resolved,
      }
    }

    if (resolved && !resolved.isRoot) {
      throw new Error(
        `[schemx] Field paths "${normalizeNamePath(path)}" and ` +
          `"${normalizeNamePath(resolved.owner.path)}" overlap. ` +
          "A value subtree can only be owned by one schema field."
      )
    }

    if (this.owners.has(key)) {
      return { action: "noop", path, key }
    }

    for (const owner of this.owners.values()) {
      if (areOverlappingFieldPaths(path, owner.path)) {
        throw new Error(
          `[schemx] Field paths "${normalizeNamePath(path)}" and ` +
            `"${normalizeNamePath(owner.path)}" overlap. ` +
            "A value subtree can only be owned by one schema field."
        )
      }
    }

    return { action: "create", path, key }
  }

  /**
   * 提交普通字段 owner 注册计划。
   *
   * @param plan 由 `prepareFieldRegistration` 生成的注册计划。
   */
  commitFieldRegistration(plan: FieldRegistrationPlan<TValues>): void {
    if (plan.action !== "create") return

    this.owners.set(plan.key, {
      kind: "field",
      path: plan.path,
      key: plan.key,
    })
  }

  /**
   * 校验 FieldArray 注册，并返回需要吸收的普通后代 owner。
   *
   * @param path 要注册的数组根路径。
   * @returns 数组 owner 的复用或创建计划。
   * @throws 当路径与已有数组 owner 或普通 owner 不兼容时抛出错误。
   */
  prepareFieldArrayRegistration<TName extends NamePath<TValues>>(
    path: TName
  ): FieldArrayRegistrationPlan<TValues> {
    const key = createFieldKey(path)

    const existing = this.owners.get(key)

    if (existing?.kind === "fieldArray") {
      return { action: "reuse", path, key, absorbedKeys: [] }
    }

    const absorbedKeys: FieldKey[] = []

    for (const owner of this.owners.values()) {
      if (owner.key === key || !areOverlappingFieldPaths(path, owner.path)) {
        continue
      }

      const canAbsorbDescendant =
        owner.kind === "field" && isDescendantFieldPath(owner.path, path)

      if (canAbsorbDescendant) {
        absorbedKeys.push(owner.key)
        continue
      }

      if (owner.kind === "fieldArray") {
        throw new Error(
          `[schemx] FieldArray paths "${normalizeNamePath(path)}" and ` +
            `"${normalizeNamePath(owner.path)}" overlap. ` +
            "Nested FieldArray paths are not supported."
        )
      }

      throw new Error(
        `[schemx] FieldArray path "${normalizeNamePath(path)}" overlaps ` +
          `registered field "${normalizeNamePath(owner.path)}". ` +
          "A value subtree can only be owned by one field."
      )
    }

    return { action: "create", path, key, absorbedKeys }
  }

  /**
   * 提交 FieldArray owner 注册计划并吸收普通后代 owner。
   *
   * @param plan 由 `prepareFieldArrayRegistration` 生成的注册计划。
   */
  commitFieldArrayRegistration(plan: FieldArrayRegistrationPlan<TValues>): void {
    if (plan.action !== "create") return

    for (const absorbedKey of plan.absorbedKeys) {
      this.owners.delete(absorbedKey)
    }

    this.owners.set(plan.key, {
      kind: "fieldArray",
      path: plan.path,
      key: plan.key,
    })
  }

  /**
   * 清空 owner 注册表，供 Store 销毁时释放路径状态。
   */
  clear(): void {
    this.owners.clear()
  }
}

/**
 * 暴露 owner 注册表的内部能力，不暴露其构造方式。
 */
export type OwnedSubtreeRegistry<TValues extends Values> =
  OwnedSubtreeRegistryImpl<TValues>

/**
 * 创建值子树 owner 注册表。
 *
 * @typeParam TValues 表单值对象类型。
 * @returns 可供 Store 组合根使用的 owner 注册表。
 * @example
 * ```ts
 * const registry = createOwnedSubtreeRegistry<FormValues>()
 * ```
 */
export function createOwnedSubtreeRegistry<
  TValues extends Values,
>(): OwnedSubtreeRegistry<TValues> {
  return new OwnedSubtreeRegistryImpl<TValues>()
}
