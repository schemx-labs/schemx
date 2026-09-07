/**
 * 注册中心共享类型。
 *
 * @module core/registry/types
 */

/**
 * 注册条目时的覆盖行为选项。
 *
 * 适用于渲染器注册中心与校验规则注册中心。
 */
export interface RegistryOptions {
  /**
   * 同名条目已存在时是否覆盖；默认覆盖。
   */
  override?: boolean
}
