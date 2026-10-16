import type { Component } from "vue"

import type { SchemxApi } from "@schemx/core"

// 创建器绑定原始组件定义；可枚举的身份标记让组件选项复制后仍能复用绑定。
const formDefinitionKey = Symbol("schemx:form-definition")

const formCreators = new WeakMap<Component, SchemxApi["createForm"]>()

// 仅供组件创建和 setup 解析使用的内部元数据。
type BoundFormComponent = Component & { [formDefinitionKey]?: Component }

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
  Object.defineProperty(component, formDefinitionKey, {
    value: component,
    enumerable: true,
  })
  formCreators.set(component, creator)
}

/**
 * 从当前组件定义或它的选项副本读取创建器。
 * @param component - 当前 Vue 组件类型。
 * @example const creator = getFormCreator(instance.type)
 */
export function getFormCreator(
  component: Component
): SchemxApi["createForm"] | undefined {
  const definition = (component as BoundFormComponent)[formDefinitionKey] ?? component

  return formCreators.get(definition)
}
