/**
 * Dynamic - 动态数组字段组件。
 *
 * 负责按 ViewSchema 的数组行边界展开 Dynamic，并将每行的 Group 与 Field
 * 委托给对应组件；字段插槽由父级 Form 透传到当前 Dynamic 子树。
 *
 * @module components/Dynamic
 */

/* eslint-disable vue/one-component-per-file */
import { defineComponent, Fragment, PropType, VNodeChild } from "vue"

import { isViewGroupSchema } from "@schemx/core"

import { getSectionPosition, normalizeNameKey } from "../../utils"
import Field from "../Field"
import Group from "../Group"

import type {
  SchemxViewDynamicSchema,
  SchemxViewFieldSchema,
  SchemxViewSchema,
} from "@schemx/core"

/** Dynamic 组件属性。 */
export interface SchemxDynamicProps {
  /** 当前 Dynamic 数组的 ViewSchema。 */
  schema: SchemxViewDynamicSchema
  /** 当前 Form 根级 ViewSchema，用于计算字段区段样式。 */
  viewSchemas: readonly SchemxViewSchema[]
}

const Dynamic = defineComponent({
  name: "SchemxDynamic",
  inheritAttrs: false,

  props: {
    schema: {
      type: Object as PropType<SchemxViewDynamicSchema>,
      required: true,
    },
    viewSchemas: {
      type: Array as PropType<readonly SchemxViewSchema[]>,
      required: true,
    },
  },

  /**
   * 初始化 Dynamic 的行模板渲染器。
   *
   * @param props - 当前 Dynamic ViewSchema 与 Form 根级 ViewSchema。
   * @param slots - 父级透传的字段插槽。
   */
  setup(props, { slots }) {
    /** 根据字段路径生成渲染 key，路径变化时重新绑定字段控制器。 */
    const getFieldRenderKey = (schema: SchemxViewFieldSchema): string =>
      `${schema.key}:${normalizeNameKey(schema.name)}`

    /** 根据根级 ViewSchema 计算 Dynamic 字段的首尾样式类。 */
    const getFieldClass = (schema: SchemxViewSchema) => {
      const { isFirst, isLast } = getSectionPosition(
        props.viewSchemas as SchemxViewSchema[],
        schema.key
      )

      return {
        "schemx-field-wrapper--first": isFirst,
        "schemx-field-wrapper--last": isLast,
      }
    }

    /** 渲染单个 Dynamic 行模板节点。 */
    const renderItemSchema = (schema: SchemxViewSchema): VNodeChild => {
      if (isViewGroupSchema(schema)) {
        return <Group key={schema.key} schema={schema} v-slots={slots} />
      }

      const field = schema as SchemxViewFieldSchema

      return (
        <Field
          key={getFieldRenderKey(field)}
          schema={field}
          class={getFieldClass(field)}
          v-slots={slots}
        />
      )
    }

    return (): VNodeChild => {
      if (props.schema.visible === false) {
        return null
      }

      return props.schema.items.map((item) => (
        <Fragment key={item.key}>{item.children.map(renderItemSchema)}</Fragment>
      ))
    }
  },
})

export default Dynamic
