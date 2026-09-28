/**
 * 为一个 Vue Form 管理字段滚动注册与定位流程。
 *
 * @module hooks/useScrollToField
 */

import { nextTick, onScopeDispose } from "vue"
import type { ShallowRef } from "vue"

import { createFieldKey, isViewDynamicSchema, isViewGroupSchema } from "@schemx/core"
import scrollIntoView from "scroll-into-view-if-needed"

import { registerVueScrollToFieldHandler } from "../bridge/scrollToField"
import {
  appendGroupScrollPath,
  getGroupScrollPathKey,
  provideFieldScrollRegistry,
} from "../context/fieldScrollContext"

import type {
  FieldScrollRegistry,
  GroupScrollController,
} from "../context/fieldScrollContext"
import type { ScrollToFieldOptions } from "../types/form"
import type {
  NamePath,
  SchemxInstance,
  SchemxViewGroupSchema,
  SchemxViewSchema,
  Values,
} from "@schemx/core"

/**
 * 初始化字段滚动能力所需的表单与响应式 ViewSchema。
 */
interface UseScrollToFieldOptions<TValues extends Values> {
  /** 接收字段滚动请求的表单实例。 */
  form: SchemxInstance<TValues>
  /** 提供字段与 Group 路径查找所需的最新 ViewSchema。 */
  viewSchemas: ShallowRef<readonly SchemxViewSchema<TValues>[]>
}

/**
 * 查找 ViewSchema 树中路径对应的可见 Group。
 *
 * @param schemas - 当前待检索的 ViewSchema 列表。
 * @param groupPath - 从表单根节点开始的 Group key 路径。
 * @param pathIndex - 当前匹配的路径位置。
 * @returns 匹配的可见 Group；未找到时返回 `undefined`。
 */
function findGroupViewSchema<TValues extends Values>(
  schemas: readonly SchemxViewSchema<TValues>[],
  groupPath: readonly string[],
  pathIndex = 0
): SchemxViewGroupSchema<TValues> | undefined {
  const expectedKey = groupPath[pathIndex]

  if (expectedKey === undefined) {
    return undefined
  }

  for (const schema of schemas) {
    if (schema.visible === false) {
      continue
    }

    if (isViewGroupSchema(schema)) {
      if (schema.key !== expectedKey) {
        continue
      }

      if (pathIndex === groupPath.length - 1) {
        return schema
      }

      return findGroupViewSchema(schema.children, groupPath, pathIndex + 1)
    }

    if (isViewDynamicSchema(schema)) {
      for (const item of schema.items) {
        const nestedGroup = findGroupViewSchema(item.children, groupPath, pathIndex)

        if (nestedGroup) {
          return nestedGroup
        }
      }
    }
  }

  return undefined
}

/**
 * 查找字段在当前 ViewSchema 树中的 Group 祖先路径。
 *
 * @param schemas - 当前待检索的 ViewSchema 列表。
 * @param fieldKey - 使用 Core 路径身份规则生成的目标字段 key。
 * @param groupPath - 当前递归位置的 Group key 路径。
 * @returns 找到字段时返回其 Group 祖先路径；字段不可见或不存在时返回 `undefined`。
 */
function findFieldGroupPath<TValues extends Values>(
  schemas: readonly SchemxViewSchema<TValues>[],
  fieldKey: string,
  groupPath: readonly string[] = []
): readonly string[] | undefined {
  for (const schema of schemas) {
    if (schema.visible === false) {
      continue
    }

    if (isViewGroupSchema(schema)) {
      const childPath = appendGroupScrollPath(groupPath, schema.key)

      const nestedPath = findFieldGroupPath(schema.children, fieldKey, childPath)

      if (nestedPath !== undefined) {
        return nestedPath
      }

      continue
    }

    if (isViewDynamicSchema(schema)) {
      for (const item of schema.items) {
        const nestedPath = findFieldGroupPath(item.children, fieldKey, groupPath)

        if (nestedPath !== undefined) {
          return nestedPath
        }
      }

      continue
    }

    if (createFieldKey(schema.name) === fieldKey) {
      return groupPath
    }
  }

  return undefined
}

/**
 * 提供字段 DOM 注册表，并将表单的 `scrollToField` 请求连接到当前组件。
 *
 * @param options - 当前表单实例与响应式 ViewSchema。
 *
 * @example
 * ```ts
 * useScrollToField({ form, viewSchemas })
 * ```
 */
export function useScrollToField<TValues extends Values>(
  options: UseScrollToFieldOptions<TValues>
): void {
  const registeredFields = new Map<string, Set<HTMLElement>>()

  const registeredGroups = new Map<string, GroupScrollController>()

  const fieldScrollRegistry: FieldScrollRegistry = {
    register(key, element) {
      let elements = registeredFields.get(key)

      if (!elements) {
        elements = new Set()
        registeredFields.set(key, elements)
      }

      elements.add(element)

      return () => {
        elements?.delete(element)

        if (elements?.size === 0) {
          registeredFields.delete(key)
        }
      }
    },
    find(key) {
      const elements = registeredFields.get(key)

      if (!elements) {
        return undefined
      }

      for (const element of elements) {
        if (!element.isConnected || element.getClientRects().length === 0) {
          continue
        }

        let ancestor: HTMLElement | null = element

        let isHidden = false

        while (ancestor) {
          const style = getComputedStyle(ancestor)

          if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            style.visibility === "collapse"
          ) {
            isHidden = true
            break
          }

          ancestor = ancestor.parentElement
        }

        if (!isHidden) {
          return element
        }
      }

      return undefined
    },
    registerGroup(path, controller) {
      const pathKey = getGroupScrollPathKey(path)

      registeredGroups.set(pathKey, controller)

      return () => {
        if (registeredGroups.get(pathKey) === controller) {
          registeredGroups.delete(pathKey)
        }
      }
    },
    getGroup(path) {
      return registeredGroups.get(getGroupScrollPathKey(path))
    },
    getGroupCollapsed(path) {
      return findGroupViewSchema(options.form.getViewSchemas(), path)?.collapsed
    },
  }

  provideFieldScrollRegistry(fieldScrollRegistry)

  const scrollToField = async (
    name: NamePath<TValues>,
    scrollOptions?: ScrollToFieldOptions
  ): Promise<boolean> => {
    await nextTick()

    const fieldKey = createFieldKey(name)

    let target = fieldScrollRegistry.find(fieldKey)

    if (!target) {
      const groupPath = findFieldGroupPath(options.viewSchemas.value, fieldKey)

      if (groupPath === undefined) {
        return false
      }

      for (let index = 0; index < groupPath.length; index += 1) {
        const currentPath = groupPath.slice(0, index + 1)

        const groupController = fieldScrollRegistry.getGroup(currentPath)

        if (!groupController || !(await groupController.requestExpand())) {
          return false
        }

        await nextTick()
      }

      target = fieldScrollRegistry.find(fieldKey)
    }

    if (!target) {
      return false
    }

    scrollIntoView(target, {
      behavior: scrollOptions?.behavior ?? "smooth",
      block: scrollOptions?.block ?? "center",
      inline: scrollOptions?.inline ?? "nearest",
      scrollMode: "if-needed",
    })

    return true
  }

  onScopeDispose(registerVueScrollToFieldHandler(options.form, scrollToField))
}
