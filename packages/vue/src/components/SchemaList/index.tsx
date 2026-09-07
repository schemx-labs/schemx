/**
 * SchemaList - 统一递归渲染 ViewSchema 列表。
 *
 * 负责在 Form、Group 和 Dynamic 的每个同级 Schema 列表上建立 Row，并将每个节点
 * 交给 Col 包装；未解析到 Col 组件时保持原有透明渲染。
 *
 * @module components/SchemaList
 */

import { defineComponent, h, type PropType } from "vue"
import type { ClassValue, VNodeChild } from "vue"

import {
  isSchemxViewFieldSchema,
  isViewDynamicSchema,
  isViewGroupSchema,
} from "@schemx/core"

import { normalizeNameKey } from "../../utils"
import Col from "../Col"
import Dynamic from "../Dynamic"
import Field from "../Field"
import Group from "../Group"

import type { SchemxColComponent } from "../../types/layout"
import type { SchemxViewFieldSchema, SchemxViewSchema, Values } from "@schemx/core"

/** SchemaList 的公开属性。 */
export interface SchemxSchemaListProps<TValues extends Values = Values> {
  /** 当前同级 ViewSchema 列表。 */
  schemas: readonly SchemxViewSchema<TValues>[]
  /** 根级 ViewSchema 列表，供 Field 首尾样式计算。 */
  viewSchemas: readonly SchemxViewSchema<TValues>[]
  /** 当前 Form 解析出的 Col 实现；为空时不创建布局包装。 */
  colComponent?: SchemxColComponent
  /** 根级 Field wrapper 的 class 解析器。 */
  fieldClassResolver?: (schema: SchemxViewSchema<TValues>) => ClassValue
}

const SchemaList = defineComponent({
  name: "SchemxSchemaList",
  inheritAttrs: false,

  props: {
    schemas: {
      type: Array as PropType<readonly SchemxViewSchema[]>,
      required: true,
    },
    viewSchemas: {
      type: Array as PropType<readonly SchemxViewSchema[]>,
      required: true,
    },
    colComponent: {
      type: [Object, Function] as PropType<SchemxColComponent>,
      required: false,
      default: undefined,
    },
    fieldClassResolver: {
      type: Function as PropType<(schema: SchemxViewSchema) => ClassValue>,
      required: false,
      default: undefined,
    },
  },

  setup(props, { slots }) {
    const getFieldRenderKey = (schema: SchemxViewFieldSchema): string =>
      `${schema.key}:${normalizeNameKey(schema.name)}`

    const getSchemaRenderKey = (schema: SchemxViewSchema): string => {
      if (isSchemxViewFieldSchema(schema)) {
        return getFieldRenderKey(schema)
      }

      return schema.key
    }

    const renderChildren = (schemas: readonly SchemxViewSchema[]): VNodeChild => {
      return h(
        SchemaList,
        {
          schemas,
          viewSchemas: props.viewSchemas,
          colComponent: props.colComponent,
        },
        slots
      )
    }

    const renderSchema = (schema: SchemxViewSchema): VNodeChild => {
      if (schema.visible === false) {
        return null
      }

      let content: VNodeChild

      if (isViewGroupSchema(schema)) {
        content = (
          <Group
            key={schema.key}
            schema={schema}
            renderChildren={renderChildren}
            v-slots={slots}
          />
        )
      } else if (isViewDynamicSchema(schema)) {
        content = (
          <Dynamic
            key={schema.key}
            schema={schema}
            viewSchemas={props.viewSchemas}
            renderChildren={renderChildren}
            v-slots={slots}
          />
        )
      } else {
        content = (
          <Field
            key={getFieldRenderKey(schema)}
            schema={schema}
            class={props.fieldClassResolver?.(schema)}
            v-slots={slots}
          />
        )
      }

      if (!props.colComponent) {
        return content
      }

      return (
        <Col
          key={getSchemaRenderKey(schema)}
          component={props.colComponent}
          layout={schema.layout}
        >
          {content}
        </Col>
      )
    }

    return (): VNodeChild => {
      const children = props.schemas.map(renderSchema)

      if (!props.colComponent) {
        return children
      }

      return <div class="schemx-row">{children}</div>
    }
  },
})

export default SchemaList
