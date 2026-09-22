/**
 * Core 兼容用的旧版静态布局配置。
 *
 * 新布局类型由 UI 适配层定义。
 *
 * @deprecated 请改用 {@link import("@schemx/vue").SchemxColConfig}。
 */
export interface SchemxLayout {
  /** 节点占据的栅格列数。 */
  span?: number

  /** 节点左侧偏移的栅格列数。 */
  offset?: number

  /** 节点是否独占当前布局行。 */
  block?: boolean
}
