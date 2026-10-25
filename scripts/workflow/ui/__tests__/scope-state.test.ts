// 范围状态的归属、父链、类型关联与结束幂等，不依赖终端渲染。
import { describe, expect, expectTypeOf, it } from "vite-plus/test"

import { createScopeState } from "../scope-state.ts"
import { createSession } from "../session.ts"

import type { FlowId, GroupId, TaskId } from "../scope-state.ts"

// 每个场景单独持有实例状态，不安装进程级监听。
function fixture() {
  // 会话提供实例有效性校验，不读取任何终端资源。
  const session = createSession()

  // 登记与父级校验只使用本实例的会话操作。
  const state = createScopeState({
    check: session.check,
    checkExecution: session.checkExecution,
  })

  return { session, state }
}

describe("范围状态", () => {
  it("种类决定标识类型，相同标题生成不同记录且拒绝跨实例与跨种类使用", () => {
    // 两个登记器之间没有共享记录或计数状态。
    const { state } = fixture()

    // 对照实例无法查询第一个登记器生成的标识。
    const other = fixture().state

    // 标题相同不代表同一个流程。
    const flowId = state.register({ kind: "flow", title: "检查" })

    // 显式父级只影响逻辑层级，不影响标识种类。
    const groupId = state.register({ kind: "group", title: "检查", parentId: flowId })

    // 任务登记返回独立的任务标识。
    const taskId = state.register({ kind: "task", title: "检查", parentId: groupId })

    expectTypeOf(flowId).toEqualTypeOf<FlowId>()
    expectTypeOf(groupId).toEqualTypeOf<GroupId>()
    expectTypeOf(taskId).toEqualTypeOf<TaskId>()
    expect(state.register({ kind: "flow", title: "检查" })).not.toBe(flowId)
    expect(state.requireScope(taskId, "task")).toMatchObject({
      title: "检查",
      parentId: groupId,
      ended: false,
    })
    expect(() => state.requireScope(flowId, "task")).toThrow("类型不匹配")
    expect(() => other.requireScope(flowId)).toThrow("不属于")
    expect(() =>
      other.register({ kind: "group", title: "外部", parentId: flowId })
    ).toThrow("不属于")
    expect(other.snapshot()).toEqual([])
  })

  it("结束幂等，结束的父级不再接收内容或子范围", () => {
    // 查询结果是只读视图，结束状态由登记器统一修改。
    const { state } = fixture()

    // 子任务将依赖这个父范围的有效性。
    const groupId = state.register({ kind: "group", title: "阶段" })

    // 已取得的只读视图也应反映结束状态。
    const record = state.requireScope(groupId)

    state.end(groupId)
    state.end(groupId)
    expect(record.ended).toBe(true)
    expect(state.snapshot()).toHaveLength(1)
    expect(() => state.checkParent(groupId)).toThrow("父级已经结束")
    expect(() =>
      state.register({ kind: "task", title: "后续", parentId: groupId })
    ).toThrow("父级已经结束")
  })

  it("后代查询保留登记顺序，排除祖先自身与无关流程", () => {
    // 构造多个层级和独立流程，验证查询不依赖当前展示位置。
    const { state } = fixture()

    // 根流程作为查询祖先，不应出现在自身后代列表中。
    const flowId = state.register({ kind: "flow", title: "流程" })

    // 第一层分组先登记，因此在后代列表中排在任务之前。
    const groupId = state.register({ kind: "group", title: "阶段", parentId: flowId })

    // 深层任务必须通过父链命中根流程。
    const nested = state.register({ kind: "task", title: "深层", parentId: groupId })

    // 无关流程及其任务不能进入第一个流程的后代列表。
    const other = state.register({ kind: "flow", title: "无关" })

    state.register({ kind: "task", title: "无关任务", parentId: other })
    // 直接子任务登记较晚，查询顺序也应较晚。
    const direct = state.register({ kind: "task", title: "直接", parentId: flowId })

    state.end(nested)
    expect(
      state.descendants(flowId).map(
        /**
         * 将只读记录映射成标识，以断言查询顺序。
         * @param record - 查询返回的后代记录。
         */
        (record) => record.id
      )
    ).toEqual([groupId, nested, direct])
    expect(state.descendants(groupId)).toEqual([state.requireScope(nested)])
    expect(state.descendants(direct)).toEqual([])
  })

  it("清空登记只释放记录，实例取消和释放仍由会话决定", () => {
    // 会话与范围登记保持各自的状态所有权。
    const { state, session } = fixture()

    // 清空后这个标识失效，实例本身仍可以输出或创建范围。
    const flowId = state.register({ kind: "flow", title: "流程" })

    state.dispose()
    state.dispose()
    expect(state.snapshot()).toEqual([])
    expect(() => state.requireScope(flowId)).toThrow("不属于")
    expect(session.isDisposed()).toBe(false)
    session.beginSignal()
    expect(() => state.register({ kind: "task", title: "取消后" })).toThrow("操作已取消")
    expect(() => state.checkParent(undefined)).not.toThrow()
    session.beginFinalizing()
    session.dispose({ unsubscribe: () => {}, release: state.dispose })
    expect(() => state.checkParent(undefined)).toThrow("已释放")
  })
})
