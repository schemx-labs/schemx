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
  /**
   * 容器及其后代是否可见。
   */
  readonly visible: boolean

  /**
   * 容器及其后代是否只读。
   */
  readonly readonly: boolean

  /**
   * 容器及其后代是否禁用。
   */
  readonly disabled: boolean
}

/**
 * 容器依赖 effect 计算出的动态状态覆盖集合。
 */
export type ContainerDynamicOverrides = Partial<ContainerEffectiveState>

/**
 * Group 和 Dependency 共享的运行时呈现状态。
 */
export interface ContainerRuntimeState {
  /**
   * 当前容器的静态呈现状态 signal。
   */
  readonly staticState: Signal<ContainerStaticState>

  /**
   * 当前容器的动态状态覆盖 signal。
   */
  readonly dynamicOverrides: Signal<ContainerDynamicOverrides>

  /**
   * 合并自身静态状态、动态覆盖和祖先状态后的有效状态。
   */
  readonly effectiveState: ComputedSignal<ContainerEffectiveState>
}

/**
 * 创建容器运行时状态的配置。
 */
export interface CreateContainerRuntimeStateOptions {
  /**
   * 容器运行时节点的唯一标识，用于 signal 调试名称。
   */
  readonly nodeId: number

  /**
   * 容器编译后的静态状态。
   */
  readonly staticState: ContainerStaticState

  /**
   * 当前节点从祖先容器投影得到的有效状态。
   */
  readonly inheritedState: ComputedSignal<ContainerEffectiveState>
}

/**
 * 创建容器运行时状态。
 *
 * `visible` 与祖先状态做逻辑与，`readonly` 和 `disabled` 与祖先状态做逻辑或。
 *
 * @param options - 容器静态状态和祖先有效状态。
 * @returns 包含静态状态、动态覆盖和有效状态的运行时状态。
 *
 * @remarks
 * 动态覆盖只影响当前容器自身；祖先状态仍会通过 `effectiveState` 递归约束后代。
 */
export function createContainerRuntimeState(
  options: CreateContainerRuntimeStateOptions
): ContainerRuntimeState {
  // 创建可被静态 Schema 更新的容器状态 signal。
  const staticState = createSignal(options.staticState ?? DEFAULT_CONTAINER_STATE, {
    name: `container:${options.nodeId}:staticState`,
  })

  // 创建 dependencies 解析结果写入的动态覆盖 signal。
  const dynamicOverrides = createSignal<ContainerDynamicOverrides>(
    {},
    {
      name: `container:${options.nodeId}:dynamicOverrides`,
    }
  )

  // 创建合并自身状态与祖先状态的派生 signal。
  const effectiveState = createComputed<ContainerEffectiveState>(() => {
    // 读取祖先有效状态以建立容器层级依赖。
    const inherited = options.inheritedState.value

    // 读取当前容器的静态状态与动态覆盖。
    const current = staticState.value

    const overrides = dynamicOverrides.value

    // 未配置动态值时回退到当前容器的静态值。
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
 * @typeParam TValues - 当前表单值类型。
 * @param node - 需要继承容器状态的节点。
 * @returns 最近已挂载容器的有效状态；不存在时返回默认状态。
 */
export function createInheritedContainerState<TValues extends Values>(
  node: DescribedRuntimeNode<TValues>
): ComputedSignal<ContainerEffectiveState> {
  return createComputed(() => readInheritedContainerState(node.parent))
}

// 容器没有静态配置时使用的默认有效状态。
const DEFAULT_CONTAINER_STATE: ContainerEffectiveState = {
  visible: true,
  readonly: false,
  disabled: false,
}

/**
 * 沿父节点向上查找最近的已挂载容器状态。
 *
 * @typeParam TValues - 当前表单值类型。
 * @param parent - 当前节点的父运行时节点。
 * @returns 最近祖先容器的有效状态，或根级默认状态。
 */
function readInheritedContainerState<TValues extends Values>(
  parent: ContainerRuntimeNode<TValues> | null
): ContainerEffectiveState {
  // 从当前节点父级开始向根节点遍历。
  let current = parent

  while (current && current.type !== "root") {
    if (current.containerState) {
      return current.containerState.effectiveState.value
    }

    current = current.parent
  }

  return DEFAULT_CONTAINER_STATE
}
