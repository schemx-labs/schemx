/**
 * 容器 dependencies effect。
 *
 * @module core/runtime/container/dependenciesEffect
 */

import { createDynamicPropsEffect } from "../dynamicProps/effect"

import { setContainerDynamicOverrides } from "./runtimeState"

import type { Values } from "../../types"
import type { SchemaRuntimeContext } from "../context"
import type { ContainerDynamicPropsDescriptor } from "../descriptor"
import type { Scope } from "../node"
import type { ContainerDynamicOverrides, ContainerRuntimeState } from "./runtimeState"

/**
 * 容器 dependencies 支持的动态属性键。
 */
export const CONTAINER_DEPENDENCIES_PROP_KEYS = [
  "visible",
  "readonly",
  "disabled",
] as const

/**
 * 创建容器 dependencies effect 的配置。
 */
export interface CreateContainerDependenciesEffectOptions<
  TValues extends Values = Values,
> {
  readonly context: SchemaRuntimeContext<TValues>
  readonly dynamicProps: ContainerDynamicPropsDescriptor<TValues>
  readonly runtimeState: ContainerRuntimeState
  readonly scope: Scope
}

/**
 * 创建容器级 dependencies effect。
 *
 * @param options - 动态属性描述、运行时状态和资源作用域。
 */
export function createContainerDependenciesEffect<TValues extends Values>(
  options: CreateContainerDependenciesEffectOptions<TValues>
): void {
  const { context, dynamicProps, runtimeState, scope } = options

  createDynamicPropsEffect<TValues, ContainerDynamicOverrides>({
    context,
    dependencies: dynamicProps.dependencies,
    triggerFields: dynamicProps.triggerFields,
    propKeys: CONTAINER_DEPENDENCIES_PROP_KEYS,
    scope,
    onSuccess: (overrides) => {
      setContainerDynamicOverrides(runtimeState, overrides)
    },
  })
}
