import Search from "../searchRuntime.js"

import { bindFormCreator } from "./formCreators"
import { withSearchInstall } from "./installSearch"

import type { SchemxSearchPlugin } from "./installSearch"
import type { SchemxApi } from "@schemx/core"

/**
 * 复制公开 Search 入口定义并绑定独立创建器，保留泛型与插件安装能力。
 * @param creator - 当前 Search 创建内部表单时使用的同步创建器。
 * @param name - Vue 组件名称，默认 SchemxSearch。
 * @param ui - 可选的 UI 适配标识，只作用于该入口的根节点。
 * @example const Search = createSearchComponent(schemx.createForm, "MySchemxSearch")
 */
export function createSearchComponent(
  creator: SchemxApi["createForm"],
  name = "SchemxSearch",
  ui?: string
): SchemxSearchPlugin {
  // 可枚举的创建器元数据随组件选项副本保留。
  const component = Object.assign({}, Search, { name })

  bindFormCreator(component, creator, ui)

  return withSearchInstall(component)
}
