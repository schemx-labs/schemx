/**
 * 字段字典域。
 *
 * Core 使用字段顶层的 dict 配置管理请求生命周期与当前选项。
 *
 * @module core/dictionary
 */

export { createFieldDictionaryChannel } from "./createChannel"

export { isSchemxDictionary, normalizeSchemxDictionary } from "./types"

export type { FieldDictionaryChannelOptions } from "./createChannel"

export type {
  DictionaryKeyMap,
  FieldDictionaryChannel,
  FieldDictionaryFailureReason,
  FieldDictionaryOptionsAction,
  FieldDictionaryResult,
  FieldDictionarySnapshot,
  FieldDictionaryStatus,
  SchemxDictionary,
  SchemxDictionaryInput,
} from "./types"
