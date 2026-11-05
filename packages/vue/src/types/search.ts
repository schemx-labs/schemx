import type { SchemxActionButtonProps, SchemxFormProps } from "./form"
import type { Values } from "@schemx/core"

/**
 * 搜索组件配置；操作区独立放在右侧，不使用 Form 的 actionCol。
 *
 * 收起时按实际布局保留第一行高度，全部可见字段保持挂载。
 * @typeParam TValues - 搜索条件的值类型。
 */
export interface SchemxSearchProps<TValues extends Values = Values> extends Omit<
  SchemxFormProps<TValues>,
  "actionCol"
> {
  /**
   * 折叠配置；默认启用，true 使用默认配置，false 展示全部条件并隐藏触发器。
   */
  collapse?: SchemxSearchCollapseAction
}

/**
 * 折叠操作的启用配置；true 使用默认行为，false 展示全部条件。
 */
export type SchemxSearchCollapseAction = boolean | SchemxSearchCollapseActionConfig

/**
 * 搜索区折叠的状态、文案、按钮属性与变更回调。
 */
export interface SchemxSearchCollapseActionConfig {
  /**
   * 受控折叠状态；通过 onCollapsedChange 接受切换请求。
   */
  collapsed?: boolean
  /**
   * 非受控初始状态，默认 true；后续修改不重置当前状态。
   */
  defaultCollapsed?: boolean
  /**
   * 展开按钮文案，默认“展开”。
   */
  expandText?: string
  /**
   * 收起按钮文案，默认“收起”。
   */
  collapseText?: string
  /**
   * 折叠按钮的外观属性，沿用当前 UI 按钮类型；原生行为和点击事件由 Search 管理。
   */
  buttonProps?: SchemxActionButtonProps
  /**
   * 用户切换或字段定位时接收期望的状态；受控模式需由调用方更新 collapsed。
   * @param collapsed - 请求切换后的折叠状态。
   */
  onCollapsedChange?: (collapsed: boolean) => void
}

/**
 * 自定义折叠触发器接收的状态与切换动作。
 */
export interface SchemxSearchCollapseSlotProps {
  /**
   * 当前实际折叠状态。
   */
  collapsed: boolean
  /**
   * 反转当前状态；受控时仅调用 onCollapsedChange 请求更新。
   */
  toggle: () => void
}
