/**
 * Group - 分组字段组件
 *
 * 用于渲染包含 children 的 Group ViewSchema。
 * 支持可折叠的分组容器，内部递归渲染子字段和子分组。
 *
 * @module components/Group
 */

import { computed, defineComponent, getCurrentInstance, PropType, ref, watch } from "vue"
import type { ClassValue, StyleValue, VNodeChild } from "vue"

import { isViewDynamicSchema, isViewGroupSchema } from "@schemx/core"
import classnames from "classnames"

import { normalizeId, normalizeNameKey } from "../../utils"
import Field from "../Field"

import { createGroupSlotRenderers } from "./slot"

import type { SchemxViewGroupSchema, SchemxViewSchema } from "@schemx/core"

/** Group Props。 */
export interface SchemxGroupProps {
  schema: SchemxViewGroupSchema
  /** 父级传入的 class，会与内部和 Schema class 合并。 */
  class?: ClassValue
  /** 父级传入的 style，会在 Schema style 之前合并。 */
  style?: StyleValue
  /**
   * 内部 SchemaList 递归渲染子节点的回调；未提供时使用 Group 自身的兼容渲染器。
   */
  renderChildren?: (schemas: readonly SchemxViewSchema[]) => VNodeChild
}

const Group = defineComponent({
  name: "SchemxGroup",
  inheritAttrs: false,

  props: {
    schema: {
      type: Object as PropType<SchemxViewGroupSchema>,
      required: true,
    },
    class: {
      type: [String, Object, Array, Boolean] as PropType<ClassValue>,
      required: false,
      default: undefined,
    },
    style: {
      type: [String, Object, Array] as PropType<StyleValue>,
      required: false,
      default: undefined,
    },
    renderChildren: {
      type: Function as PropType<SchemxGroupProps["renderChildren"]>,
      required: false,
      default: undefined,
    },
  },

  setup(props, { attrs, slots }) {
    const internalCollapsed = ref(Boolean(props.schema.defaultCollapsed))

    const collapsed = computed(() => props.schema.collapsed ?? internalCollapsed.value)

    const componentId = getCurrentInstance()?.uid ?? 0

    watch(
      () => props.schema.collapsed,
      (nextCollapsed, previousCollapsed) => {
        if (nextCollapsed !== undefined) {
          internalCollapsed.value = nextCollapsed
        } else if (previousCollapsed !== undefined) {
          internalCollapsed.value = previousCollapsed
        }
      }
    )

    const toggle = () => {
      if (!props.schema.collapsible || props.schema.disabled) {
        return
      }

      const nextCollapsed = !collapsed.value

      if (props.schema.collapsed === undefined) {
        internalCollapsed.value = nextCollapsed
      }

      props.schema.onCollapsedChange?.(nextCollapsed)
    }

    return (): VNodeChild => {
      const schema = props.schema

      if (schema.visible === false) {
        return null
      }

      const collapsible = Boolean(schema.collapsible)

      const isCollapsed = collapsed.value

      const destroyOnCollapse = schema.destroyOnCollapse ?? true

      const uniqueId = schema.debug?.runtimeNodeId ?? `local-${componentId}`

      const idBase = `schemx-group-${uniqueId}-${normalizeId(schema.key)}`

      const headerId = `${idBase}-header`

      const bodyId = `${idBase}-body`

      const renderChild = (child: SchemxViewSchema): VNodeChild => {
        if (isViewDynamicSchema(child)) {
          if (child.visible === false) {
            return null
          }

          return child.items.map((item) =>
            item.children.map((itemChild) => renderChild(itemChild))
          )
        }

        if (isViewGroupSchema(child)) {
          return (
            <Group
              key={child.key}
              schema={child as SchemxViewGroupSchema}
              class={props.class}
              style={props.style}
              v-slots={slots}
            />
          )
        }

        return (
          <Field
            key={`${child.key}:${normalizeNameKey(child.name)}`}
            schema={child}
            v-slots={slots}
          />
        )
      }

      const { hasHeader, renderBodyContent, renderHeaderContent } =
        createGroupSlotRenderers({
          schema,
          collapsed: isCollapsed,
          collapsible,
          disabled: Boolean(schema.disabled),
          readonly: Boolean(schema.readonly),
          toggle,
          slots,
          renderChildren: () =>
            props.renderChildren
              ? props.renderChildren(schema.children)
              : schema.children.map(renderChild),
        })

      const body = (
        <div
          id={bodyId}
          role="group"
          aria-labelledby={schema.label ? headerId : undefined}
          aria-hidden={isCollapsed || undefined}
          class="schemx-group__body"
          style={!destroyOnCollapse && isCollapsed ? { display: "none" } : undefined}
        >
          {renderBodyContent()}
        </div>
      )

      return (
        <div
          {...attrs}
          class={classnames(
            "schemx-group-wrapper",
            props.class,
            attrs.class,
            schema.class
          )}
          data-key={schema.key}
          aria-disabled={schema.disabled || undefined}
          style={[attrs.style, props.style, schema.style]}
        >
          <div
            class={classnames("schemx-group", {
              "schemx-group--collapsed": isCollapsed,
              "is-readonly": schema.readonly,
              "is-disabled": schema.disabled,
            })}
          >
            {hasHeader && (
              <div
                id={headerId}
                role={collapsible ? "button" : undefined}
                tabindex={collapsible ? (schema.disabled ? -1 : 0) : undefined}
                aria-expanded={collapsible ? !isCollapsed : undefined}
                aria-controls={collapsible ? bodyId : undefined}
                aria-disabled={collapsible ? schema.disabled || undefined : undefined}
                class={classnames("schemx-group__header", {
                  "schemx-group__header--clickable": collapsible && !schema.disabled,
                })}
                onClick={toggle}
                onKeydown={(e: KeyboardEvent) => {
                  if (!schema.disabled && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault()
                    toggle()
                  }
                }}
              >
                {renderHeaderContent()}
              </div>
            )}
            {destroyOnCollapse ? !isCollapsed && body : body}
          </div>
        </div>
      )
    }
  },
})

export default Group
