/**
 * 字段字典运行态类型。
 *
 * 字典由字段的顶层 dict 配置启用，由 Core 管理请求与选项。
 *
 * @module core/dictionary/types
 */

import { resolveDictionaryTarget } from "./target"

import type { NamePath, SchemxInstance, Values } from "../types"

/**
 * 字典状态。
 *
 * - `idle`：尚未请求
 * - `loading`：请求进行中
 * - `success`：请求成功、本地写入，或因 `shouldFetch` 跳过而得到空列表
 * - `failed`：最近一次请求失败
 */
export type FieldDictionaryStatus = "idle" | "loading" | "success" | "failed"

/**
 * 字典操作失败原因。
 *
 * 使用 `failed` 而非 `error`，避免与结果上的 `error` 字段混淆。
 */
export type FieldDictionaryFailureReason =
  "unregistered" | "disposed" | "aborted" | "failed"

/**
 * 字典选项的字段映射。
 *
 * 用于后端直接返回业务字段（如 `{ name, code }`）且未配置 `formatter` 的场景：
 * Core 会按映射补出统一的 `label` / `value` / `children` / `disabled`，原字段保留；
 * 选项的筛选与更新规则由消费端在列表 action 中决定。
 */
export interface DictionaryKeyMap {
  /** 显示文本字段名，如 `name`；省略时不做映射。 */
  readonly labelKey?: string
  /**
   * 值字段名，如 `code`；省略时不做映射。
   */
  readonly valueKey?: string
  /** 子选项字段名，如 `subs`；声明时递归映射子节点。 */
  readonly childrenKey?: string
  /** 禁用字段名，如 `forbidden`；省略时不做映射。 */
  readonly disabledKey?: string
}

/**
 * 字段字典配置。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TResponse - `api` 的返回值类型。
 * @typeParam TOption - `formatter` 产出的选项类型。
 * @typeParam TForm - 回调收到的表单实例类型，框架层可收窄为自身实例。
 */
export interface SchemxDictionary<
  TValues extends Values = Values,
  TResponse = unknown,
  TOption = unknown,
  TForm extends SchemxInstance<TValues> = SchemxInstance<TValues>,
> {
  /**
   * 接收选项数组的组件属性，缺省时使用 Renderer 默认目标或 options。
   */
  targetKey?: string

  /**
   * 未配置 formatter 时，将后端字段映射为标准选项字段，缺省时使用 Renderer 的映射。
   */
  keys?: DictionaryKeyMap

  /**
   * 数据获取函数。
   *
   * 接收当前表单值、表单实例与中止信号，返回原始数据（支持异步）。
   *
   * @param values - 当前表单值。
   * @param form - 当前表单实例。
   * @param signal - 当前请求的中止信号。
   */
  api: (
    values: TValues,
    form: TForm,
    signal?: AbortSignal
  ) => TResponse | Promise<TResponse>

  /**
   * 响应数据格式化函数。
   *
   * 缺省时要求 `api` 直接返回数组。
   *
   * @param res - `api` 返回并 await 后的结果。
   * @param form - 当前表单实例。
   */
  formatter?: (res: Awaited<TResponse>, form: TForm) => TOption[] | Promise<TOption[]>

  /**
   * 依赖的表单字段路径；值变化时自动重新执行 `api`。
   */
  dependsOn?: NamePath<TValues>[]

  /**
   * 是否应该执行 `api`；返回 `false` 时清空选项且不记错误。
   */
  shouldFetch?: (values: TValues) => boolean

  /**
   * 是否在字段节点挂载后的 post 阶段自动加载。
   *
   * 默认 true，与组件渲染及字段可见性无关；false 时跳过首次加载，依赖变化仍会重新加载。
   */
  immediate?: boolean

  /**
   * 依赖变化时是否清空当前字段的值。
   */
  resetOnDepsChange?: boolean

  /**
   * 失败重试次数，默认 `0`（不重试）。
   */
  retryCount?: number

  /**
   * 重试间隔（毫秒），默认 `1000`。
   */
  retryInterval?: number

  /**
   * 请求失败回调。
   */
  onError?: (error: Error, form: TForm) => void

  /**
   * 请求成功回调；在 `formatter` 之后、写入选项之后调用。
   */
  onSuccess?: (data: TOption[], form: TForm) => void

  /**
   * 依赖字段变化回调；在 `shouldFetch` 判断之前调用。
   */
  onDepsChange?: (values: TValues, form: TForm) => void
}

/**
 * 字典配置的注册形式：完整配置或 `api` 简写。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TResponse - `api` 的返回值类型。
 * @typeParam TOption - 选项类型。
 * @typeParam TForm - 回调收到的表单实例。
 */
export type SchemxDictionaryInput<
  TValues extends Values = Values,
  TResponse = unknown,
  TOption = unknown,
  TForm extends SchemxInstance<TValues> = SchemxInstance<TValues>,
> =
  | SchemxDictionary<TValues, TResponse, TOption, TForm>
  | SchemxDictionary<TValues, TResponse, TOption, TForm>["api"]
  | false

/**
 * 判断输入是否为完整字典配置。
 *
 * @param input - 任意字典配置输入。
 * @returns 是否为对象形式的字典配置。
 */
export function isSchemxDictionary<
  TValues extends Values = Values,
  TResponse = unknown,
  TOption = unknown,
  TForm extends SchemxInstance<TValues> = SchemxInstance<TValues>,
>(
  input: SchemxDictionaryInput<TValues, TResponse, TOption, TForm> | undefined
): input is SchemxDictionary<TValues, TResponse, TOption, TForm> {
  return typeof input === "object" && input !== null && "api" in input
}

/**
 * 把 `api` 简写规范化为完整字典配置。
 *
 * @param input - 完整配置或 `api` 函数。
 * @returns 规范化后的配置；未配置或关闭时返回 `undefined`。
 */
export function normalizeSchemxDictionary<
  TValues extends Values = Values,
  TResponse = unknown,
  TOption = unknown,
  TForm extends SchemxInstance<TValues> = SchemxInstance<TValues>,
>(
  input: SchemxDictionaryInput<TValues, TResponse, TOption, TForm> | undefined
): SchemxDictionary<TValues, TResponse, TOption, TForm> | undefined {
  if (input === undefined || input === false) {
    return undefined
  }

  if (typeof input === "function") {
    return { api: input }
  }

  if (!isSchemxDictionary(input) || typeof input.api !== "function") {
    throw new TypeError("[schemx] 字段 dict 必须提供 api 函数，或设为 false。")
  }

  resolveDictionaryTarget(input.targetKey)

  return input
}

/**
 * 字典当前选项与请求状态的快照。
 *
 * @typeParam TOption - 选项类型。
 */
export interface FieldDictionarySnapshot<TOption = unknown> {
  /**
   * 当前生效的选项；刷新成功后由远端结果整体覆盖。
   */
  readonly options: readonly TOption[]
  /**
   * 当前状态。
   */
  readonly status: FieldDictionaryStatus
  /**
   * 是否请求中。
   */
  readonly loading: boolean
  /**
   * 最近一次失败原因。
   */
  readonly error: Error | undefined
  /**
   * 成功请求的版本号，本地修改不递增。
   */
  readonly version: number
}

/**
 * 字典操作结果。
 *
 * 未注册、已销毁、请求被中止都是正常业务分支，因此不抛错。
 */
export type FieldDictionaryResult<TOption = unknown> =
  | {
      readonly ok: true
      readonly options: readonly TOption[]
      readonly version: number
    }
  | {
      readonly ok: false
      readonly reason: FieldDictionaryFailureReason
      readonly error?: Error
    }

/**
 * 当前选项列表的替换值或更新函数。
 *
 * @typeParam TOption - 选项类型。
 * @param options - updater 收到的当前只读列表，应返回新列表。
 */
export type FieldDictionaryOptionsAction<TOption = unknown> =
  readonly TOption[] | ((options: readonly TOption[]) => readonly TOption[])

/**
 * 单个字段的字典运行态；本地修改在刷新成功后由远端结果覆盖。
 *
 * @typeParam TOption - 选项类型。
 */
export interface FieldDictionaryChannel<TOption = unknown> {
  /**
   * 选项注入到 ViewSchema 的属性名。
   */
  readonly targetKey: string
  /**
   * 建立依赖监听，按 immediate 决定是否自动加载。
   * @example channel.start()
   */
  start(): void
  /**
   * 读取当前选项。
   * @example channel.options()
   */
  options(): readonly TOption[]
  /**
   * 仅读取当前加载标记。
   * @example channel.isLoading()
   */
  isLoading(): boolean
  /**
   * 读取选项与请求状态。
   * @example channel.snapshot()
   */
  snapshot(): FieldDictionarySnapshot<TOption>
  /**
   * 尚未成功时请求；加载中等待当前请求。
   * @example await channel.load()
   */
  load(): Promise<FieldDictionaryResult<TOption>>
  /**
   * 重新请求；未完成请求合并，成功后整体覆盖当前选项。
   * @example await channel.refresh()
   */
  refresh(): Promise<FieldDictionaryResult<TOption>>
  /**
   * 中止在途请求，保留当前选项。
   * @example channel.cancel()
   */
  cancel(): void
  /**
   * 同步替换当前选项，不触发请求，也不取消在途请求。
   * @param action - 新列表或根据当前列表返回新列表的函数，不应修改输入。
   * @example channel.setOptions([])
   * @example channel.setOptions((options) => [...options])
   */
  setOptions(action: FieldDictionaryOptionsAction<TOption>): void
  /**
   * 释放依赖监听并中止在途请求。
   * @example channel.dispose()
   */
  dispose(): void
}
