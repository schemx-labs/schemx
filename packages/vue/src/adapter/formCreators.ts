import type { Component } from "vue"

import type { SchemxApi } from "@schemx/core"

// 可枚举的 Symbol 直接保存创建器，组件选项复制后继续保留绑定。
const formCreatorKey = Symbol("schemx:form-creator")

// 仅供组件创建和 setup 解析使用的内部元数据。
type BoundFormComponent = Component & {
  [formCreatorKey]?: SchemxApi["createForm"]
}

/**
 * 绑定当前组件定义的创建器，不向组件树传播。
 * @param component - 新创建的组件定义。
 * @param creator - 同步表单创建器。
 * @example bindFormCreator(component, schemx.createForm)
 */
export function bindFormCreator(
  component: Component,
  creator: SchemxApi["createForm"]
): void {
  Object.assign(component, { [formCreatorKey]: creator })
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
