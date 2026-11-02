import { createForm, getFormAdapter } from "../../index"

import type { DeepReadonly, ReadonlyState } from "../../index"

/**
 * 用嵌套对象验证路径与原生状态的只读类型。
 */
interface FormValues {
  /**
   * 普通对象字段。
   */
  profile: { name: string }
  /**
   * 数组字段及其成员路径。
   */
  tags: string[]
}

// 表单类型约束所有字段状态。
const form = createForm<FormValues>({
  initialValues: { profile: { name: "Ada" }, tags: ["first"] },
})

// 原生只读状态统一入口。
const adapter = getFormAdapter(form)

// 沿用既有 ReadonlyState，不要求框架使用新的泛型容器协议。
const state: ReadonlyState<FormValues> = adapter.values

// peek 保留深层只读快照类型。
const values: DeepReadonly<FormValues> = state.peek()

// 首次与后续通知都接收当前只读值。
const stop: () => void = state.subscribe((current) => {
  // 通知参数与直接读取具有相同类型。
  const snapshot: DeepReadonly<FormValues> = current

  void snapshot
})

// 路径状态保留具体字段类型。
const profile: ReadonlyState<FormValues["profile"] | undefined> =
  adapter.field("profile").value

// 表单聚合状态与原生布尔状态具有相同的读取协议。
const loading: boolean = adapter.loading.peek()

// @ts-expect-error 不支持业务类型之外的路径。
adapter.field("missing")
// @ts-expect-error 不暴露共享适配器销毁入口。
adapter.dispose()
// @ts-expect-error 已移除额外来源协议转换。
adapter.source(profile)
// @ts-expect-error 原生状态的 value 只读。
adapter.loading.value = true
// @ts-expect-error 快照仍然深层只读。
values.profile.name = "Grace"
// @ts-expect-error 不允许修改原生只读数组。
adapter.field("tags").value.peek()?.push("next")
// @ts-expect-error 原生成员状态没有新增 getSnapshot 协议。
profile.getSnapshot()
// @ts-expect-error 固定路径状态没有节点身份属性。
void adapter.field("profile").name

void stop
void loading
