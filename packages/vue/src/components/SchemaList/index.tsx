/**
 * SchemaList - 统一递归渲染 ViewSchema 列表。
 *
 * 负责遍历同级 ViewSchema，将节点分发给 Field、Group 和 Dynamic，并为当前列表
 * 建立 Row 包裹；Col 由 Field、Group 和 Dynamic 的布局路径负责。
 *
 * @module components/SchemaList
 */

import { defineComponent, h, type PropType } from "vue"
import type { ClassValue, VNodeChild } from "vue"

import { isViewDynamicSchema, isViewGroupSchema } from "@schemx/core"

import { normalizeNameKey } from "../../utils"
import Dynamic from "../Dynamic"
import Field from "../Field"
import Group from "../Group"
import Row from "../Row"

import type { SchemxRowConfig } from "../../types/layout"
import type { SchemxViewFieldSchema, SchemxViewSchema, Values } from "@schemx/core"

import "./index.css"

/**
 * SchemaList 的公开属性。
 */
export interface SchemxSchemaListProps<TValues extends Values = Values> {
  /**
   * 当前同级 ViewSchema 列表。
   */
  schemas: readonly SchemxViewSchema<TValues>[]
  /**
   * 根级 ViewSchema 列表，供 Field 首尾样式计算。
   */
  viewSchemas: readonly SchemxViewSchema<TValues>[]
  /**
   * 当前 Form 或父级容器继承的 Row 配置。
   */
  rowConfig?: SchemxRowConfig
  /**
   * 根级 Field wrapper 的 class 解析器。
   */
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
    rowConfig: {
      type: Object as PropType<SchemxRowConfig>,
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
    /**
     * 根据字段路径生成稳定的 Field 渲染 key。
     *
     * @param schema - 当前字段 ViewSchema。
     * @returns 包含 Schema key 和字段路径的渲染 key。
     */
    const getFieldRenderKey = (schema: SchemxViewFieldSchema): string =>
      `${schema.key}:${normalizeNameKey(schema.name)}`

    /**
     * 递归创建子级 SchemaList，并复用当前 Form 的布局与字段渲染配置。
     *
     * @param schemas - 当前子级 ViewSchema 列表。
     * @returns 子级 SchemaList 的 VNode。
     */
    const renderChildren = (
      schemas: readonly SchemxViewSchema[],
      rowConfig: SchemxRowConfig | undefined = props.rowConfig
    ): VNodeChild => {
      return h(
        SchemaList,
        {
          schemas,
          viewSchemas: props.viewSchemas,
          rowConfig,
          fieldClassResolver: props.fieldClassResolver,
        },
        slots
      )
    }

    /**
     * 将单个 ViewSchema 分发为 Field、Group 或 Dynamic。
     *
     * @param schema - 当前待渲染的 ViewSchema。
     * @returns 当前 Schema 对应的 VNode。
     */
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
            rowConfig={props.rowConfig}
            renderChildren={renderChildren}
            v-slots={slots}
          />
        )
      } else if (isViewDynamicSchema(schema)) {
        content = (
          <Dynamic
            key={schema.key}
            schema={schema}
            rowConfig={props.rowConfig}
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

      return content
    }

    return (): VNodeChild => {
      return (
        <Row row={props.rowConfig} class="schemx-schema-list">
          {props.schemas.map(renderSchema)}
        </Row>
      )
    }
  },
})

export default SchemaList
