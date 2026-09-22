/**
 * Dynamic - 动态数组字段组件。
 *
 * 负责按 ViewSchema 的数组行边界展开 Dynamic，并将每行的 Row 配置传给 SchemaList；
 * 子节点具体渲染委托给 SchemaList，字段插槽由父级 Form 透传到当前 Dynamic 子树。
 *
 * @module components/Dynamic
 */

/* eslint-disable vue/one-component-per-file */
import { defineComponent, Fragment } from "vue"
import type { PropType, VNodeChild } from "vue"

import Col from "../Col"

import type { SchemxRowConfig } from "../../types/layout"
import type { SchemxViewDynamicSchema, SchemxViewSchema } from "@schemx/core"

/**
 * Dynamic 组件属性。
 */
export interface SchemxDynamicProps {
  /**
   * 当前 Dynamic 数组的 ViewSchema。
   */
  schema: SchemxViewDynamicSchema
  /**
   * 从 Form 或父级 Schema 继承的 Row 配置。
   */
  rowConfig?: SchemxRowConfig
  /**
   * 由 SchemaList 提供的子级 Schema 渲染回调。
   *
   * @param schemas - 当前数组项的子级 ViewSchema。
   * @param rowConfig - 当前数组项继承到的 Row 配置。
   */
  renderChildren: (
    schemas: readonly SchemxViewSchema[],
    rowConfig?: SchemxRowConfig
  ) => VNodeChild
}

const Dynamic = defineComponent({
  name: "SchemxDynamic",
  inheritAttrs: false,

  props: {
    schema: {
      type: Object as PropType<SchemxViewDynamicSchema>,
      required: true,
    },
    rowConfig: {
      type: Object as PropType<SchemxRowConfig>,
      required: false,
      default: undefined,
    },
    renderChildren: {
      type: Function as PropType<SchemxDynamicProps["renderChildren"]>,
      required: true,
    },
  },

  /**
   * 初始化 Dynamic 的行模板渲染器。
   *
   * @param props - 当前 Dynamic ViewSchema、继承的 Row 配置和子级渲染回调。
   */
  setup(props) {
    return (): VNodeChild => {
      if (props.schema.visible === false) {
        return null
      }

      const rowConfig =
        props.rowConfig || props.schema.row
          ? { ...props.rowConfig, ...props.schema.row }
          : undefined

      const items = props.schema.items.map((item) => {
        const children =
          rowConfig === undefined
            ? props.renderChildren(item.children)
            : props.renderChildren(item.children, rowConfig)

        return <Fragment key={item.key}>{children}</Fragment>
      })

      if (!props.schema.layout) {
        return items
      }

      return <Col col={props.schema.layout}>{items}</Col>
    }
  },
})

export default Dynamic
