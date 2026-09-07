/**
 * Schema 节点的静态 24 栅格布局配置。
 *
 * Core 只保存并透传布局元数据，不负责渲染或转换为具体 UI 组件库的 Props。
 * 未设置的字段由适配层决定默认行为。
 */
export interface SchemxLayout {
  /**
   * 节点占据的栅格列数，约定范围为 1–24。
   */
  span?: number

  /**
   * 节点左侧偏移的栅格列数，约定范围为 0–23。
   */
  offset?: number

  /**
   * 节点是否独占当前布局行。
   *
   * 适配层应在该值为 true 时将节点映射为满宽布局；未设置时不改变 span 的语义。
   */
  block?: boolean
}
