import Form from "../formRuntime.js"

import { bindFormCreator, withInstall } from "./index"

import type { SchemxFormPlugin } from "./index"
import type { SchemxApi } from "@schemx/core"

/**
 * 复制公开 Form 入口定义并绑定创建器，返回保留泛型、插槽与公开实例契约的可安装组件。
 * @param creator - 当前组件创建内部表单时使用的同步创建器。
 * @param name - 组件名称，默认 SchemxForm。
 * @param ui - 可选的 UI 适配标识，只作用于该入口的根节点。
 * @example const Form = createFormComponent(schemx.createForm, "MySchemxForm")
 */
export function createFormComponent(
  creator: SchemxApi["createForm"],
  name = "SchemxForm",
  ui?: string
): SchemxFormPlugin {
  // 手写调用签名描述泛型消费；运行时导出是编译后的 Vue 组件选项对象。
  const component = Object.assign({}, Form, { name })

  bindFormCreator(component, creator, ui)

  return withInstall(component)
}
