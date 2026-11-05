/**
 * SchemaList - 统一递归渲染 ViewSchema 列表。
 *
 * 负责遍历同级 ViewSchema，将节点分发给 Field、Group 和 Dynamic，并为当前列表
 * 建立 Row 包裹；根级行尾可追加操作列，Col 由各节点和调用方负责。
 *
 * @module components/SchemaList
 */

import { defineComponent, h, type PropType } from "vue"
import type { Slots, VNodeChild } from "vue"

import { isViewDynamicSchema, isViewGroupSchema } from "@schemx/core"

import { getSectionPosition } from "../../utils"
import Dynamic from "../Dynamic"
import Field from "../Field"
import Group from "../Group"
import Row from "../Row"

import type { SchemxRowConfig } from "../../types"
import type { SchemxViewSchema, Values } from "@schemx/core"

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
   * 业务字段插槽，与当前列表的行尾扩展插槽分别传递。
   */
  fieldSlots: Slots
}

// 统一拥有 Row 与递归分发，字段插槽和行尾插槽使用独立通道。
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
    fieldSlots: {
      type: Object as PropType<Slots>,
      required: true,
    },
  },

  /**
   * 渲染当前列表，并将字段插槽递归传递给后代。
   * @param props - 当前视图列表、行布局和字段插槽。
   * @param context - 当前列表的行尾扩展插槽；不会传给递归子列表。
   */
  setup(props, context) {
    /**
     * 递归创建子级 SchemaList，并复用当前 Form 的布局与字段渲染配置。
     *
     * @param schemas - 当前子级 ViewSchema 列表。
     * @param rowConfig - 当前子级继承或覆盖的 Row 配置。
     * @returns 子级 SchemaList 的 VNode。
     */
    const renderChildren = (
      schemas: readonly SchemxViewSchema[],
      rowConfig: SchemxRowConfig | undefined = props.rowConfig
    ): VNodeChild => {
      return h(SchemaList, {
        schemas,
        viewSchemas: props.viewSchemas,
        rowConfig,
        fieldSlots: props.fieldSlots,
      })
    }

    /**
     * 统一计算根列表中的首尾样式，不让布局组件重复组装。
     * @param schema - 当前渲染的字段节点。
     */
    const getFieldClass = (schema: SchemxViewSchema) => {
      // 子级节点继续沿用根列表语义，与原来的解析回调一致。
      const { isFirst, isLast } = getSectionPosition(
        props.viewSchemas as SchemxViewSchema[],
        schema.key
      )

      return {
        "schemx-field-wrapper--first": isFirst,
        "schemx-field-wrapper--last": isLast,
      }
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
            key={schema.nodeId}
            schema={schema}
            rowConfig={props.rowConfig}
            renderChildren={renderChildren}
            v-slots={props.fieldSlots}
          />
        )
      } else if (isViewDynamicSchema(schema)) {
        content = (
          <Dynamic
            key={schema.nodeId}
            schema={schema}
            rowConfig={props.rowConfig}
            renderChildren={renderChildren}
            v-slots={props.fieldSlots}
          />
        )
      } else {
        content = (
          <Field
            key={schema.nodeId}
            schema={schema}
            class={getFieldClass(schema)}
            v-slots={props.fieldSlots}
          />
        )
      }

      return content
    }

    return (): VNodeChild => {
      return (
        <Row row={props.rowConfig} class="schemx-schema-list">
          {props.schemas.map(renderSchema)}
          {context.slots.default?.()}
        </Row>
      )
    }
  },
})

export default SchemaList
