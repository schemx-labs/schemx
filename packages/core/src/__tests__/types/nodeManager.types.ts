import { createNodeManager } from "../../node"

import type { NodePathUpdate } from "../../node"
import type { NamePath } from "../../types"

// 节点路径 API 保留表单值类型，不放宽为任意字符串。
interface FormValues {
  name: string
  users: { name: string }[]
}

// 查询快照和批量更新共享同一份路径约束。
const manager = createNodeManager<FormValues>()

const paths: readonly NamePath<FormValues>[] = manager.getPaths()

const path: NamePath<FormValues> | undefined = manager.getPath(1)

const update: NodePathUpdate<FormValues> = { nodeId: 1, path: "users.0.name" }

manager.updatePaths([update])
manager.getNodeId("name")
manager.getNodeIds("users.0.name")
// @ts-expect-error 查询路径必须属于表单。
manager.getNodeId("missing")
// @ts-expect-error 批量更新不能使用未知路径。
manager.updatePaths([{ nodeId: 1, path: "missing" }])
// @ts-expect-error 更新项保持只读。
update.path = "name"
// @ts-expect-error 路径快照只读。
paths.push("name")
void path
