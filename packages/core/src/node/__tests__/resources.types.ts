import { unmountNodeResources } from ".."

import type { FieldNode, NodeLifecycleHooks, NodeSnapshot } from ".."
import type { FormRuntimeContext } from "../../runtimeContext"

// 生命周期只接收只读数据；资源卸载仍接收内部节点。
declare const hooks: NodeLifecycleHooks
declare const snapshot: NodeSnapshot
declare const node: FieldNode
declare const context: FormRuntimeContext

hooks.unmounted?.(snapshot)
unmountNodeResources(node, context)
// @ts-expect-error 普通快照不公开 Scope。
snapshot.scope.dispose()
if (snapshot.type === "field") {
  // @ts-expect-error 普通字段路径没有 value 属性。
  void snapshot.name.value
}

// @ts-expect-error 节点元数据不可赋值。
snapshot.id = 42
// @ts-expect-error 配置只读，更新必须通过 Schema source。
snapshot.compiledSchema.visible = false
// @ts-expect-error 不能把内部节点传给快照 hook。
hooks.mounted?.(node)
// @ts-expect-error 底层资源卸载入口不承担值清理。
unmountNodeResources(node, context, { isRemoveFieldValue: true })
