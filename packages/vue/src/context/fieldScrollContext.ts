/**
 * Vue `scrollToField` 使用的字段元素与 Group 注册上下文。
 *
 * @module context/fieldScrollContext
 */

import { inject, provide } from "vue"
import type { InjectionKey } from "vue"

/**
 * 管理单个 Schemx 表单中的字段元素与 Group 控制器。
 */
export interface FieldScrollRegistry {
  /**
   * 注册字段容器元素。
   *
   * @param key - 按 Core 字段路径规则生成的 key。
   * @param element - 当前渲染的字段容器元素。
   * @returns 元素卸载或字段路径变化时调用的注销函数。
   *
   * @example
   * ```ts
   * const unregister = registry.register(fieldKey, wrapperElement)
   * unregister()
   * ```
   */
  register(key: string, element: HTMLElement): () => void
  /**
   * 查找已连接、有布局盒且未被祖先样式隐藏的字段容器元素。
   *
   * @param key - 目标字段的 Core 路径 key。
   * @returns 可见的容器元素；未找到时返回 `undefined`。
   *
   * @example
   * ```ts
   * const element = registry.find(fieldKey)
   * ```
   */
  find(key: string): HTMLElement | undefined
  /**
   * 注册 Group 的展开控制器。
   *
   * @param path - 从表单根节点开始的 Group key 路径。
   * @param controller - 已挂载 Group 的展开控制器。
   * @returns Group 卸载或隐藏时调用的注销函数。
   *
   * @example
   * ```ts
   * const unregister = registry.registerGroup(groupPath, controller)
   * unregister()
   * ```
   */
  registerGroup(path: readonly string[], controller: GroupScrollController): () => void
  /**
   * 查找已挂载 Group 的展开控制器。
   *
   * @param path - 从表单根节点开始的 Group key 路径。
   * @returns 找到的控制器；未注册时返回 `undefined`。
   *
   * @example
   * ```ts
   * const controller = registry.getGroup(groupPath)
   * ```
   */
  getGroup(path: readonly string[]): GroupScrollController | undefined
  /**
   * 读取当前 ViewSchema 中 Group 的受控折叠状态。
   *
   * @param path - 从表单根节点开始的 Group key 路径。
   * @returns Group 的 `collapsed` 值；未找到或未受控时返回 `undefined`。
   *
   * @example
   * ```ts
   * const collapsed = registry.getGroupCollapsed(groupPath)
   * ```
   */
  getGroupCollapsed(path: readonly string[]): boolean | undefined
}

/**
 * 提供 `scrollToField` 展开折叠 Group 的控制入口。
 */
export interface GroupScrollController {
  /**
   * 请求展开 Group；已折叠且禁用、不可折叠或受控状态未更新时返回 `false`。
   *
   * @example
   * ```ts
   * const expanded = await controller.requestExpand()
   * ```
   */
  requestExpand(): Promise<boolean>
}

// 让同一表单下的 Field 与 Group 共享字段滚动注册表。
const FIELD_SCROLL_REGISTRY_KEY: InjectionKey<FieldScrollRegistry> = Symbol(
  "schemx:field-scroll-registry"
)

// 让嵌套 Group 继承祖先的 Schema key 路径。
const GROUP_SCROLL_PATH_KEY: InjectionKey<readonly string[]> = Symbol(
  "schemx:group-scroll-path"
)

/**
 * 向当前表单的后代组件提供字段滚动注册表。
 *
 * @param registry - 当前表单的字段与 Group 注册表。
 *
 * @example
 * ```ts
 * provideFieldScrollRegistry(fieldScrollRegistry)
 * ```
 */
export function provideFieldScrollRegistry(registry: FieldScrollRegistry): void {
  provide(FIELD_SCROLL_REGISTRY_KEY, registry)
}

/**
 * 读取最近的表单字段滚动注册表。
 *
 * @example
 * ```ts
 * const registry = useFieldScrollRegistry()
 * ```
 */
export function useFieldScrollRegistry(): FieldScrollRegistry | undefined {
  return inject(FIELD_SCROLL_REGISTRY_KEY, undefined)
}

/**
 * 向后代组件提供当前 Group 的完整 key 路径。
 *
 * @param path - 从表单根节点到当前 Group 的 key 路径。
 *
 * @example
 * ```ts
 * provideGroupScrollPath(groupPath)
 * ```
 */
export function provideGroupScrollPath(path: readonly string[]): void {
  provide(GROUP_SCROLL_PATH_KEY, path)
}

/**
 * 读取最近祖先 Group 的 key 路径；无祖先时返回空路径。
 *
 * @example
 * ```ts
 * const parentPath = useGroupScrollPath()
 * ```
 */
export function useGroupScrollPath(): readonly string[] {
  return inject(GROUP_SCROLL_PATH_KEY, [])
}

/**
 * 在祖先路径末尾追加当前 Group key，保留各层边界。
 *
 * @param parentPath - 祖先 Group 的 key 路径。
 * @param groupKey - 当前 Group 的 Schema key。
 *
 * @example
 * ```ts
 * const groupPath = appendGroupScrollPath(parentPath, schema.key)
 * ```
 */
export function appendGroupScrollPath(
  parentPath: readonly string[],
  groupKey: string
): readonly string[] {
  return [...parentPath, groupKey]
}

/**
 * 将 Group key 路径编码为不会混淆层级边界的注册表 key。
 *
 * @param path - 从表单根节点开始的 Group key 路径。
 *
 * @example
 * ```ts
 * const key = getGroupScrollPathKey(["basic", "details"])
 * ```
 */
export function getGroupScrollPathKey(path: readonly string[]): string {
  return JSON.stringify(path)
}
