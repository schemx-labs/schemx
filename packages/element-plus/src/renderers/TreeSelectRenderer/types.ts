/** TreeSelect Renderer 类型。 */

import type { SchemxBaseComponentProps } from "@schemx/vue"
import type {
  CheckedInfo,
  SelectProps,
  TreeComponentProps,
  TreeNodeData,
} from "element-plus"

/** TreeSelect 原生组件 Props。 */
type TreeSelectComponentProps = TreeComponentProps &
  Omit<Partial<SelectProps>, "props"> & {
    /** 延迟加载节点的缓存数据。 */
    cacheData?: TreeNodeData[]
  }

/** 树形选择器节点。 */
export type TreeSelectOption = TreeNodeData

/** 树形选择器字段值。 */
export type TreeSelectValue = Exclude<SelectProps["modelValue"], undefined>

/** TreeSelect Renderer Props。 */
export interface TreeSelectRendererProps
  /* @vue-ignore */
  extends
    Omit<SchemxBaseComponentProps, "value" | "onChange" | "onBlur" | "onUpdate:value">,
    /* @vue-ignore */
    Partial<
      Omit<
        TreeSelectComponentProps,
        | "modelValue"
        | "disabled"
        | "placeholder"
        | "key"
        | "ref"
        | "ref_for"
        | "ref_key"
        | "onUpdate:modelValue"
        | "onBlur"
        | "onFocus"
      >
    > {
  /** 当前树形选择值。 */
  value?: TreeSelectValue
  /** Schemx 树形选项；内部映射为 Element Plus data。 */
  options?: TreeSelectOption[]
  /** Element Plus 原生树数据。 */
  data?: TreeComponentProps["data"]
  /** Element Plus 树节点字段映射。 */
  props?: TreeComponentProps["props"]
  /** Element Plus 树节点唯一标识字段。 */
  nodeKey?: TreeComponentProps["nodeKey"]
  /** Element Plus 选择值字段。 */
  valueKey?: SelectProps["valueKey"]
  /** 树形选择值变化回调。 */
  onChange?: (value: TreeSelectValue) => void
  /** 树形选择器失焦回调。 */
  onBlur?: (event: FocusEvent) => void
  /** 树形选择器聚焦回调。 */
  onFocus?: (event: FocusEvent) => void
  /** 树节点勾选回调。 */
  onCheck?: (data: TreeNodeData, info: CheckedInfo) => void
  /** 树节点点击回调。 */
  onNodeClick?: (data: TreeNodeData, node: unknown, event: MouseEvent) => void
  /** 树节点展开回调。 */
  onNodeExpand?: (data: TreeNodeData, node: unknown, instance: unknown) => void
  /** 下拉面板显示状态变化回调。 */
  onVisibleChange?: (visible: boolean) => void
  /** 清空树形选择回调。 */
  onClear?: () => void
  /** Renderer 根节点的 CSS 类名。 */
  className?: string
  /** 只读状态下的空值占位文本。 */
  readonlyPlaceholder?: string
}
