/**
 * FormGroup - 分组字段组件
 *
 * 用于渲染包含 children 的 Group ViewSchema。
 * 支持可折叠的分组容器，内部渲染子 columns。
 *
 * @module components/FormGroup
 */

import { computed, defineComponent, getCurrentInstance, PropType, ref, watch } from "vue"
import type { SetupContext, VNodeChild } from "vue"

import classnames from "classnames"

import FormItem from "../FormItem"

import type { SchemxViewGroupSchema, SchemxViewSchema, Values } from "@schemx/core"

/**
 * FormGroup Props
 *
 * @typeParam T - 表单值类型
 */
export interface SchemxGroupProps<T extends Values = Values> {
  schema: SchemxViewGroupSchema<T>
}

const FormGroup = defineComponent(
  <T extends Values = Values>(props: SchemxGroupProps<T>, { slots }: SetupContext) => {
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

      const body = (
        <div
          id={bodyId}
          role="group"
          aria-labelledby={schema.label ? headerId : undefined}
          aria-hidden={isCollapsed || undefined}
          class="schemx-group__body"
          style={!destroyOnCollapse && isCollapsed ? { display: "none" } : undefined}
        >
          {schema.children.map((child) => (
            <FormItem
              key={child.key}
              schema={child as SchemxViewSchema}
              v-slots={slots}
            />
          ))}
        </div>
      )

      return (
        <div
          class={classnames(
            "schemx-group",
            {
              "schemx-group--collapsed": isCollapsed,
              "is-readonly": schema.readonly,
              "is-disabled": schema.disabled,
            },
            schema.class as string | undefined
          )}
          style={schema.style}
          data-key={schema.key}
          aria-disabled={schema.disabled || undefined}
        >
          {schema.label && (
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
              <span class="schemx-group__title">{schema.label}</span>
              {collapsible && (
                <span
                  class={classnames("schemx-group__arrow", {
                    "schemx-group__arrow--down": !isCollapsed,
                  })}
                />
              )}
            </div>
          )}
          {destroyOnCollapse ? !isCollapsed && body : body}
        </div>
      )
    }
  },
  {
    name: "SchemxGroup",

    props: {
      schema: {
        type: Object as PropType<SchemxViewGroupSchema>,
        required: true,
      },
    },
  }
)

export default FormGroup

const normalizeId = (key: string): string => {
  return String(key).replace(/[^a-zA-Z0-9_-]/g, "-")
}
