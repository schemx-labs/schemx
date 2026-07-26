/**
 * 容器运行时状态。
 *
 * Group 和 Dependency 共享静态状态、dependencies 动态覆盖和祖先状态继承逻辑。
 *
 * @module core/runtime/container/runtimeState
 */

import { createComputed, createSignal } from "../../reactivity"

import type { ComputedSignal, Signal } from "../../reactivity"
import type { Values } from "../../types"
import type { ContainerStaticState } from "../descriptor"
import type { ContainerRuntimeNode, DescribedRuntimeNode } from "../node"

/**
 * 容器有效呈现状态。
 */
export interface ContainerEffectiveState {
  readonly visible: boolean
  readonly readonly: boolean
  readonly disabled: boolean
}

/**
 * 容器动态覆盖集合。
 */
export type ContainerDynamicOverrides = Partial<ContainerEffectiveState>

/**
 * Group 和 Dependency 共享的运行时呈现状态。
 */
export interface ContainerRuntimeState {
  readonly staticState: Signal<ContainerStaticState>
  readonly dynamicOverrides: Signal<ContainerDynamicOverrides>
  readonly effectiveState: ComputedSignal<ContainerEffectiveState>
}

/**
 * 创建容器运行时状态的配置。
 */
export interface CreateContainerRuntimeStateOptions {
  readonly nodeId: number
  readonly staticState: ContainerStaticState
  readonly inheritedState: ComputedSignal<ContainerEffectiveState>
}

/**
 * 创建容器运行时状态。
 *
 * `visible` 与祖先状态做逻辑与，`readonly` 和 `disabled` 与祖先状态做逻辑或。
 *
 * @param options - 容器静态状态和祖先有效状态。
 * @returns 容器运行时状态。
 */
export function createContainerRuntimeState(
  options: CreateContainerRuntimeStateOptions
): ContainerRuntimeState {
  const staticState = createSignal(options.staticState ?? DEFAULT_CONTAINER_STATE, {
    name: `container:${options.nodeId}:staticState`,
  })

  const dynamicOverrides = createSignal<ContainerDynamicOverrides>(
    {},
    {
      name: `container:${options.nodeId}:dynamicOverrides`,
    }
  )

  const effectiveState = createComputed<ContainerEffectiveState>(() => {
    const inherited = options.inheritedState.value

    const current = staticState.value

    const overrides = dynamicOverrides.value

    const ownVisible = overrides.visible ?? current.visible

    const ownReadonly = overrides.readonly ?? current.readonly

    const ownDisabled = overrides.disabled ?? current.disabled

    return {
      visible: inherited.visible && ownVisible,
      readonly: inherited.readonly || ownReadonly,
      disabled: inherited.disabled || ownDisabled,
    }
  })

  return {
    staticState,
    dynamicOverrides,
    effectiveState,
  }
}

/**
 * 创建节点的祖先容器状态投影。
 *
 * @param node - 需要继承容器状态的节点。
 * @returns 最近已挂载容器的有效状态；不存在时返回默认状态。
 */
export function createInheritedContainerState<TValues extends Values>(
  node: DescribedRuntimeNode<TValues>
): ComputedSignal<ContainerEffectiveState> {
  return createComputed(() => readInheritedContainerState(node.parent))
}

/**
 * 更新容器静态状态，不修改当前动态覆盖。
 */
export function setContainerStaticState(
  state: ContainerRuntimeState,
  staticState: ContainerStaticState
): void {
  state.staticState.value = staticState
}

/**
 * 使用最新 dependencies 解析结果替换容器动态覆盖。
 */
export function setContainerDynamicOverrides(
  state: ContainerRuntimeState,
  overrides: ContainerDynamicOverrides
): void {
  state.dynamicOverrides.value = overrides
}

/**
 * 清空容器动态覆盖。
 */
export function resetContainerDynamicOverrides(state: ContainerRuntimeState): void {
  state.dynamicOverrides.value = {}
}

const DEFAULT_CONTAINER_STATE: ContainerEffectiveState = {
  visible: true,
  readonly: false,
  disabled: false,
}

function readInheritedContainerState<TValues extends Values>(
  parent: ContainerRuntimeNode<TValues> | null
): ContainerEffectiveState {
  let current = parent

  while (current && current.type !== "root") {
    if (current.containerState) {
      return current.containerState.effectiveState.value
    }

    current = current.parent
  }

  return DEFAULT_CONTAINER_STATE
}
