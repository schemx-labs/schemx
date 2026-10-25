// 实例内范围登记和状态校验，不输出文字或执行任务。
import { randomUUID } from "node:crypto"

/**
 * 标识由对应实例生成，并由实例验证归属。
 */
export type FlowId = `flow:${string}`

/**
 * 只能用于创建它的终端实例中的分组。
 */
export type GroupId = `group:${string}`

/**
 * 只能用于创建它的终端实例中的任务。
 */
export type TaskId = `task:${string}`

/**
 * 可关联的展示范围。
 */
export type ParentId = FlowId | GroupId | TaskId

/**
 * 范围的固定种类，决定工厂生成的标识前缀。
 */
export type ScopeKind = "flow" | "group" | "task"

// 将登记时的种类与返回标识关联，不允许调用方自行拼装记录。
type ScopeId<TKind extends ScopeKind> = `${TKind}:${string}`

/**
 * 提供给反馈模块的只读范围记录；状态变更只能经过登记模块。
 */
export interface ScopeRecord {
  /**
   * 当前实例生成的标识。
   */
  readonly id: ParentId
  /**
   * 标识对应的范围种类。
   */
  readonly kind: ScopeKind
  /**
   * 创建时固定的展示标题。
   */
  readonly title: string
  /**
   * 显式父范围，根流程没有父级。
   */
  readonly parentId: ParentId | undefined
  /**
   * 任务的可选展示目标。
   */
  readonly target?: string | undefined
  /**
   * 创建时间戳，单位为毫秒。
   */
  readonly started: number
  /**
   * 结束标记用于幂等收尾和父级可用性校验。
   */
  readonly ended: boolean
}

// 只有状态模块可以修改结束标记，不向其他模块暴露可写记录。
interface StoredScope extends ScopeRecord {
  // 修改后立即反映在只读查询结果上。
  ended: boolean
}

/**
 * 登记范围所需的原始元数据。
 * @typeParam TKind - 决定返回标识前缀的范围种类。
 */
export interface RegisterScopeOptions<TKind extends ScopeKind> {
  /**
   * 需要登记的范围种类。
   */
  readonly kind: TKind
  /**
   * 后续结果展示使用的标题。
   */
  readonly title: string
  /**
   * 必须属于当前实例且尚未结束的可选父范围。
   */
  readonly parentId?: ParentId | undefined
  /**
   * 可选展示目标，不参与标识生成。
   */
  readonly target?: string | undefined
}

// 校验闭包由 session 提供，不复制实例状态。
interface ScopeStateOptions {
  // 输出及收尾前验证实例仍有效。
  readonly check: () => void
  // 开始范围前额外验证实例尚未取消。
  readonly checkExecution: () => void
}

/**
 * 范围状态操作，不输出文字、调用消息或管理子进程。
 */
export interface ScopeState {
  /**
   * 登记范围并生成当前实例的唯一标识。
   * @typeParam TKind - 范围种类与返回标识的共同类型。
   * @param options - 范围元数据及显式父级。
   */
  register<TKind extends ScopeKind>(
    this: void,
    options: RegisterScopeOptions<TKind>
  ): ScopeId<TKind>
  /**
   * 验证标识归属及可选的预期种类。
   * @param id - 待查找的标识。
   * @param kind - 需要匹配的种类，缺省时不限制。
   */
  requireScope(this: void, id: ParentId, kind?: ScopeKind): ScopeRecord
  /**
   * 检查实例及可选父范围是否仍可使用。
   * @param parentId - 接收新内容或子范围的父级。
   */
  checkParent(this: void, parentId: ParentId | undefined): void
  /**
   * 标记范围结束，重复调用保持幂等。
   * @param id - 当前实例的范围标识。
   */
  end(this: void, id: ParentId): void
  /**
   * 按登记顺序返回所有严格后代，不包含父范围自身。
   * @param parentId - 需要查询的祖先标识。
   */
  descendants(this: void, parentId: ParentId): readonly ScopeRecord[]
  /**
   * 返回记录列表副本，保留登记顺序且不暴露 Map。
   */
  snapshot(this: void): readonly ScopeRecord[]
  /**
   * 清空实例登记记录，不产生结束反馈。
   */
  dispose(this: void): void
}

/**
 * 创建实例唯一的范围状态所有者。
 * @param options - 实例有效性和可执行性校验。
 * @example const state = createScopeState({ check, checkExecution })
 */
export function createScopeState(options: ScopeStateOptions): ScopeState {
  // 只有本闭包能够修改记录或其结束状态。
  const records = new Map<ParentId, StoredScope>()

  /**
   * 私有查找保留写权限，对外由 ScopeState 契约提供只读视图。
   * @param id - 需要查找的本实例标识。
   * @param kind - 可选的预期范围种类。
   */
  const requireScope = (id: ParentId, kind?: ScopeKind): StoredScope => {
    // 运行时同时防止跨实例及 JavaScript 消费端混用种类。
    const record = records.get(id)

    if (!record || (kind !== undefined && record.kind !== kind)) {
      throw new Error(`标识不属于当前终端或类型不匹配：${id}`)
    }

    return record
  }

  // 缺省父级仍需验证实例没有释放。
  const checkParent: ScopeState["checkParent"] = (parentId) => {
    options.check()
    if (parentId !== undefined && requireScope(parentId).ended) {
      throw new Error(`父级已经结束：${parentId}`)
    }
  }

  // 标识与记录同时登记，后续只能通过本实例查询。
  const register: ScopeState["register"] = (metadata) => {
    options.checkExecution()
    checkParent(metadata.parentId)
    // 上下文模板类型保留 kind 与标识前缀的关联。
    const id: ScopeId<typeof metadata.kind> = `${metadata.kind}:${randomUUID()}`

    records.set(id, {
      id,
      kind: metadata.kind,
      title: metadata.title,
      parentId: metadata.parentId,
      target: metadata.target,
      started: Date.now(),
      ended: false,
    })

    return id
  }

  // 一次查询同时完成校验和更新，重复结束无需额外分支。
  const end: ScopeState["end"] = (id) => {
    requireScope(id).ended = true
  }

  // 沿显式父链判断后代，不依赖当前绘制位置。
  const descendants: ScopeState["descendants"] = (parentId) => {
    requireScope(parentId)
    // 返回列表副本，消费端遍历时结束记录不改变遍历顺序。
    const found: ScopeRecord[] = []

    // Map 保留登记顺序，后代查询也使用同一顺序。
    for (const record of records.values()) {
      // 父级逐步向根移动，不修改登记时的父链。
      let parent = record.parentId

      while (parent !== undefined) {
        if (parent === parentId) {
          found.push(record)
          break
        }

        parent = requireScope(parent).parentId
      }
    }

    return found
  }

  // 只复制列表，记录依然通过只读类型提供实时结束状态。
  const snapshot = (): readonly ScopeRecord[] => [...records.values()]

  // 释放状态不调用任何展示或业务回调。
  const dispose = (): void => records.clear()

  return { register, requireScope, checkParent, end, descendants, snapshot, dispose }
}
