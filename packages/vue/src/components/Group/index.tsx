/**
 * Group - 分组字段组件
 *
 * 用于渲染包含 children 的 Group ViewSchema。
 * 支持可折叠的分组容器，并将子级 Row 配置传给 SchemaList。
 *
 * @module components/Group
 */

import { computed, defineComponent, getCurrentInstance, ref, watch } from "vue"
import type { ClassValue, PropType, SlotsType, StyleValue, VNodeChild } from "vue"

import { isViewDynamicSchema, isViewGroupSchema } from "@schemx/core"
import classnames from "classnames"

import { normalizeId, normalizeNameKey } from "../../utils"
import Col from "../Col"
import Field from "../Field"

import { createGroupSlotRenderers } from "./slot"

import type { SchemxGroupSlots } from "../../types/field"
import type { SchemxRowConfig } from "../../types/layout"
import type { SchemxViewGroupSchema, SchemxViewSchema } from "@schemx/core"

/**
 * Group Props。
 */
export interface SchemxGroupProps {
  /**
   * 当前分组的已解析 ViewSchema。
   */
  schema: SchemxViewGroupSchema
  /**
   * 从 Form 或父级 Schema 继承的 Row 配置。
   */
  rowConfig?: SchemxRowConfig
  /**
   * 父级传入的 class，会与内部和 Schema class 合并。
   */
  class?: ClassValue
  /**
   * 父级传入的 style，会在 Schema style 之前合并。
   */
  style?: StyleValue
  /**
   * 可选的子级 Schema 渲染回调；省略时 Group 递归渲染默认子级。
   *
   * @param schemas - 当前 Group 的子级 ViewSchema。
   * @param rowConfig - 当前 Group 子级使用的合并 Row 配置。
   */
  renderChildren?: (
    schemas: readonly SchemxViewSchema[],
    rowConfig?: SchemxRowConfig
  ) => VNodeChild
}

const Group = defineComponent({
  name: "SchemxGroup",
  inheritAttrs: false,

  props: {
    schema: {
      type: Object as PropType<SchemxViewGroupSchema>,
      required: true,
    },
    rowConfig: {
      type: Object as PropType<SchemxRowConfig>,
      required: false,
      default: undefined,
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

  slots: Object as SlotsType<SchemxGroupSlots>,

  /**
   * 组合 Group 的折叠状态、子级渲染和插槽内容。
   *
   * @param props - 当前 Group Schema、布局和兼容渲染回调。
   * @param setupContext - 父级透传属性与 Group 插槽。
   */
  setup(props, setupContext) {
    const { attrs, slots } = setupContext

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

    // 切换非受控 Group 的折叠状态，并通知受控回调。
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

      const rowConfig =
        props.rowConfig || schema.row ? { ...props.rowConfig, ...schema.row } : undefined

      /**
       * 按需渲染 Group 的默认子级内容；Content 插槽存在时由插槽接管布局。
       */
      const renderChild = (child: SchemxViewSchema): VNodeChild => {
        if (isViewDynamicSchema(child)) {
          if (child.visible === false) {
            return null
          }

          return child.items.map((item) => item.children.map(renderChild))
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

      const renderGroupChildren = (): VNodeChild => {
        if (!props.renderChildren) {
          return schema.children.map(renderChild)
        }

        return rowConfig === undefined
          ? props.renderChildren(schema.children)
          : props.renderChildren(schema.children, rowConfig)
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
          renderChildren: renderGroupChildren,
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

      const groupWrapper = (
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

      if (!schema.layout) {
        return groupWrapper
      }

      return <Col col={schema.layout}>{groupWrapper}</Col>
    }
  },
})

export default Group
