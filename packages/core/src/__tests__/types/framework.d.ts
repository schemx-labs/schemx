/**
 * 测试用框架适配层：显式声明展示元数据和 Renderer 事件，验证 Core 不再内置这些属性。
 * 仅参与测试类型检查，不进入发布声明。
 */
import type { FieldValue, SchemxConditionFn, Values } from "../../index"

/**

 * 测试适配层的字段展示配置，同时支持字段局部值和表单默认值。

 */
interface TestDisplayConfig {
  /**
   * 标签图标名称。
   */
  labelIcon?: string
  /**
   * 标签文本对齐。
   */
  labelAlign?: "left" | "center" | "right"
  /**
   * 标签位置。
   */
  labelPosition?: "left" | "top" | "right"
  /**
   * 标签宽度。
   */
  labelWidth?: string | number
  /**
   * 内容对齐。
   */
  contentAlign?: "left" | "center" | "right"
  /**
   * 标签冒号。
   */
  colon?: boolean
  /**
   * 必填视觉标记。
   */
  showRequiredMark?: boolean
}

declare module "../../index" {
  interface SchemxFieldDefinition extends TestDisplayConfig {}
  interface SchemxSchemaConfigDefinition extends TestDisplayConfig {}
  interface SchemxFieldDependenciesDefinition<TValues extends Values = Values> {
    /**
     * 测试框架动态必填视觉标记。
     */
    showRequiredMark?: SchemxConditionFn<TValues, boolean>
  }
  interface SchemxComponentPropsDefinition<TValues extends Values = Values> {
    /**
     * 测试 Renderer 值变化事件。
     * @param value - Renderer 提交的最新字段值。
     */
    onChange?: (value: FieldValue<TValues>) => void
    /**
     * 测试 Renderer 失焦事件。
     * @param value - 失焦时的字段值。
     */
    onBlur?: (value: FieldValue<TValues>) => void
  }
}
