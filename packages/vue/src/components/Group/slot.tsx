/**
 * Group 插槽渲染器。
 *
 * 集中处理分组 Header、Label、Content 插槽的解析和默认内容，保持
 * Group 仅负责折叠状态、子节点分发和容器布局。
 *
 * @module components/Group/slot
 */

import type { Slots, VNodeChild } from "vue"

import classnames from "classnames"

import { resolveSlot } from "../../utils"

import type { SchemxGroupSlotProps } from "../../types"
import type { SchemxViewGroupSchema, Values } from "@schemx/core"

/** Group 插槽渲染所需的状态与依赖。 */
interface GroupSlotRendererOptions<TValues extends Values = Values> {
  /** 当前分组 ViewSchema。 */
  schema: SchemxViewGroupSchema<TValues>
  /** 当前是否收起。 */
  collapsed: boolean
  /** 当前分组是否可收起。 */
  collapsible: boolean
  /** 当前分组是否禁用。 */
  disabled: boolean
  /** 当前分组是否只读。 */
  readonly: boolean
  /** 切换分组收起状态。 */
  toggle: () => void
  /** 父组件传入的所有具名插槽。 */
  slots: Slots
  /** 默认子节点渲染函数。 */
  renderChildren: () => VNodeChild
}

/**
 * 创建 Group 各区域的插槽渲染函数。
 *
 * `Header` 完全接管 Header 内部内容；`Label` 只替换默认标题；`Content`
 * 只替换 Body 内的默认子节点布局。
 */
export function createGroupSlotRenderers<TValues extends Values = Values>(
  options: GroupSlotRendererOptions<TValues>
) {
  const {
    schema,
    collapsed,
    collapsible,
    disabled,
    readonly,
    toggle,
    slots,
    renderChildren,
  } = options

  const slotKey = String(schema.key)

  const headerSlot = resolveSlot(slots, `${slotKey}Header`)

  const labelSlot = resolveSlot(slots, `${slotKey}Label`)

  const contentSlot = resolveSlot(slots, `${slotKey}Content`)

  const slotProps: SchemxGroupSlotProps<TValues> = {
    schema,
    collapsed,
    collapsible,
    disabled,
    readonly,
    toggle,
  }

  const renderHeaderContent = (): VNodeChild => {
    if (headerSlot) {
      return headerSlot(slotProps)
    }

    const label = labelSlot ? (
      labelSlot(slotProps)
    ) : (
      <span class="schemx-group__title">{schema.label}</span>
    )

    if (!collapsible) {
      return label
    }

    return (
      <>
        {label}
        <span
          class={classnames("schemx-group__arrow", {
            "schemx-group__arrow--down": !collapsed,
          })}
        />
      </>
    )
  }

  const renderBodyContent = (): VNodeChild => {
    if (contentSlot) {
      return contentSlot(slotProps)
    }

    return renderChildren()
  }

  return {
    hasHeader: Boolean(schema.label || headerSlot || labelSlot),
    renderBodyContent,
    renderHeaderContent,
  }
}
