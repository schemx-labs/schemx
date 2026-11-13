import type { Component } from "vue"

import type { SchemxApi } from "@schemx/core"

// 可枚举的 Symbol 直接保存创建器，组件选项复制后继续保留绑定。
const formCreatorKey = Symbol("schemx:form-creator")

// 当前入口所属的 UI 适配包，不通过上下文传递给嵌套表单。
const formUiKey = Symbol("schemx:form-ui")

// 仅供组件创建和 setup 解析使用的内部元数据。
type BoundFormComponent = Component & {
  [formCreatorKey]?: SchemxApi["createForm"]
  /**
   * 根节点采用的 UI 主题标识。
   */
  [formUiKey]?: string
}

/**
 * 绑定当前组件定义的创建器，不向组件树传播。
 * @param component - 新创建的组件定义。
 * @param creator - 同步表单创建器。
 * @param ui - 可选的 UI 适配标识，用于根节点的主题作用域。
 * @example bindFormCreator(component, schemx.createForm)
 */
export function bindFormCreator(
  component: Component,
  creator: SchemxApi["createForm"],
  ui?: string
): void {
  Object.assign(component, { [formCreatorKey]: creator, [formUiKey]: ui })
}

/**
 * 读取当前入口绑定的 UI 适配标识，普通 Vue 表单不提供标识。
 * @param component - 当前 Vue 组件类型。
 * @example const ui = getFormUi(instance.type)
 */
export function getFormUi(component: Component): string | undefined {
  return (component as BoundFormComponent)[formUiKey]
}

/**
 * 从当前组件定义或它的选项副本读取创建器。
 * @param component - 当前 Vue 组件类型。
 * @example const creator = getFormCreator(instance.type)
 */
export function getFormCreator(
  component: Component
): SchemxApi["createForm"] | undefined {
  return (component as BoundFormComponent)[formCreatorKey]
}
