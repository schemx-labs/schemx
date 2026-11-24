/**
 * 兼容层统一导出。
 *
 * `dict` 实现已下沉到 `@schemx/core`，本目录仅保留历史公共 API，
 * 供升级期间平滑过渡。所有导出均为弃用转发，请迁移到字段级 `dict` 配置。
 *
 * @module compat
 * @deprecated 请改用字段顶层的 `dict` 配置（由 `@schemx/core` 提供）。
 */

export {
  useDictionary,
  normalizeError,
  type UseDictionaryReturn,
  type UseDictOptionsReturn,
  type SchemxWithDictionary,
} from "./dictionary"

export { WithRemoteOptions, type RemoteOptionsInjectedProps } from "./withRemoteOptions"
