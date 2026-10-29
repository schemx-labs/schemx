import { unmountNodeResources } from ".."

import type { FieldNode } from ".."
import type { Lifecycle } from "../../lifecycle"
import type { FormRuntimeContext } from "../../runtimeContext"

// 卸载只接收资源所有者，不再接受值清理选项。
declare const lifecycle: Lifecycle<FieldNode>

// 活动字段用于验证两种资源卸载入口的签名。
declare const node: FieldNode

// Store 等领域资源由上下文提供。
declare const context: FormRuntimeContext

lifecycle.unmounted(node)
unmountNodeResources(node, context)
// @ts-expect-error 删值选项已移除，值清理归 Reconciler 负责。
lifecycle.unmounted(node, { isRemoveFieldValue: true })
// @ts-expect-error 底层资源卸载入口同样不再承担值清理。
unmountNodeResources(node, context, { isRemoveFieldValue: true })
