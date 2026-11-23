/**
 * 字典兼容层。
 *
 * `dict` 实现已下沉到 `@schemx/core` 的 `dictionary` 域，
 * 由字段顶层的 `dict` 配置驱动（见 `SchemxDictionary`）。
 *
 * 本文件仅保留历史公共 API，供升级期间平滑过渡，均为弃用转发：
 *
 * - 类型 `SchemxDictionary` / `SchemxWithDictionary`：直接重导出 Core 同名类型。
 * - 运行时 Hook `useDictionary` / `WithRemoteOptions` 等：已被 Core 的字典通道
 *   （`createFieldDictionaryChannel`）取代，此处仅保留旧签名与旧行为，
 *   不再演进，请迁移到字段级 `dict` 配置。
 *
 * @module compat/dictionary
 * @deprecated 请改用字段顶层的 `dict` 配置（由 `@schemx/core` 提供）。
 */

import { onMounted, onScopeDispose, ref, shallowRef } from "vue"

import { readFormContextInstance } from "../context"

import { useWatchFields } from "../hooks"

import type { NamePath, SchemxInstance, Values } from "@schemx/core"

export type {
  SchemxDictionary,
  SchemxDictionaryInput,
  DictionaryKeyMap,
  FieldDictionaryChannel,
  FieldDictionaryResult,
  FieldDictionaryStatus,
} from "@schemx/core"

/**
 * 为 Props 类型注入可选的 `dict` 字段。
 *
 * `dict` 可以是完整字典配置，也可以直接传入其 `api` 函数。
 *
 * @deprecated 请使用字段级 `dict` 配置，无需再手动为 Props 注入。
 * @typeParam TProps - 原始组件 Props 类型
 * @typeParam TValues - 表单值类型
 */
export type SchemxWithDictionary<TProps, TValues extends Values = Values> = TProps & {
  dict?:
    | import("@schemx/core").SchemxDictionary<TValues>
    | import("@schemx/core").SchemxDictionary<TValues>["api"]
}

/**
 * `useDictionary` 返回值。
 *
 * @deprecated 请改用字段级 `dict` 配置。
 * @typeParam TOption - 格式化后的字典选项类型。
 */
export interface UseDictionaryReturn<TOption = unknown> {
  /** 远程加载的字典选项列表（响应式） */
  list: import("vue").Ref<TOption[]>
  /** 请求加载状态（响应式） */
  loading: import("vue").Ref<boolean>
  /** 请求错误信息（响应式） */
  error: import("vue").Ref<Error | undefined>
  /** 触发字典选项加载 */
  loadDict: () => Promise<void>
  /** 使用当前配置重新执行 api */
  refresh: () => Promise<void>
  /** 直接修改 list 的值，不触发 api 调用 */
  mutate: (data: TOption[]) => void
}

/**
 * `useDictionary` 返回值的旧类型别名。
 *
 * @deprecated 请改用 {@link UseDictionaryReturn}。
 */
export type UseDictOptionsReturn<TOption = unknown> = UseDictionaryReturn<TOption>

/**
 * 将未知抛出值规范化为 `Error` 实例。
 */
export function normalizeError(err: unknown): Error {
  if (err instanceof Error) return err

  return new Error(String(err))
}

/**
 * 加载字典选项（历史 Hook）。
 *
 * 已被 Core 的字典通道取代，此处仅保留旧签名与旧行为，不再演进。
 * 新代码请使用字段顶层的 `dict` 配置。
 *
 * @deprecated 请改用字段级 `dict` 配置。
 */
export const useDictionary = <
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
  TResponse = unknown,
  TOption = unknown,
>(
  options: import("@schemx/core").SchemxDictionary<TValues, TResponse, TOption>,
  fieldName?: TName
): UseDictionaryReturn<TOption> => {
  const instance = readFormContextInstance<TValues>()

  const list = shallowRef<TOption[]>([])

  const loading = ref<boolean>(false)

  const error = ref<Error | undefined>(undefined)

  let requestCount = 0

  let activeController: AbortController | null = null

  const format = async (res: Awaited<TResponse>): Promise<TOption[]> => {
    if (typeof options?.formatter === "function") {
      return await options.formatter(res, instance)
    }

    if (!Array.isArray(res)) {
      throw new Error(
        "[schemx] Dictionary api must return an array when formatter is not provided."
      )
    }

    return res as TOption[]
  }

  const executeWithRetry = async (
    formValues: TValues,
    signal: AbortSignal
  ): Promise<Awaited<TResponse>> => {
    const maxRetries = options.retryCount ?? 0

    const retryDelay = options.retryInterval ?? 1000

    let lastError: Error = new Error("Unknown error")

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (signal.aborted) {
          throw new Error("Dictionary request aborted")
        }

        return await callDictionaryApi(formValues, instance, options.api, signal)
      } catch (err) {
        lastError = normalizeError(err)

        if (attempt < maxRetries) {
          await waitForRetry(retryDelay, signal)
        }
      }
    }

    throw lastError
  }

  const loadDict = async (): Promise<void> => {
    const currentCount = ++requestCount

    activeController?.abort()

    const controller = new AbortController()

    activeController = controller

    try {
      const formValues = instance.getFieldsSnapshot()

      if (typeof options.shouldFetch === "function" && !options.shouldFetch(formValues)) {
        list.value = []
        loading.value = false

        return
      }

      loading.value = true
      error.value = undefined

      const res = await executeWithRetry(formValues, controller.signal)

      if (currentCount !== requestCount || controller.signal.aborted) return

      const formatted = await format(res)

      if (currentCount !== requestCount || controller.signal.aborted) return

      list.value = formatted
      error.value = undefined

      if (typeof options.onSuccess === "function") {
        options.onSuccess(formatted, instance)
      }

      loading.value = false
    } catch (err) {
      if (controller.signal.aborted || currentCount !== requestCount) {
        return
      }

      const normalized = normalizeError(err)

      error.value = normalized
      list.value = []
      loading.value = false

      if (typeof options.onError === "function") {
        options.onError(normalized, instance)
      }
    } finally {
      if (activeController === controller) {
        activeController = null
      }
    }
  }

  const refresh = (): Promise<void> => loadDict()

  const mutate = (data: TOption[]): void => {
    list.value = data
  }

  if (options.dependsOn?.length) {
    useWatchFields(
      options.dependsOn,
      (latestSnapshot, _payload) => {
        if (typeof options.onDepsChange === "function") {
          options.onDepsChange(latestSnapshot as TValues, instance)
        }

        if (options.resetOnDepsChange && fieldName) {
          instance.setFieldValue(fieldName, undefined)
        }

        void loadDict()
      },
      { inequality: true }
    )
  }

  const immediate = options.immediate ?? true

  onMounted(() => {
    if (immediate) {
      void loadDict()
    }
  })

  onScopeDispose(() => {
    requestCount += 1
    activeController?.abort()
    activeController = null
  })

  return { list, loading, error, loadDict, refresh, mutate }
}

/**
 * 可响应 AbortSignal 的重试等待。
 */
function waitForRetry(delay: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let abort = (): void => {}

    const cleanup = (): void => {
      clearTimeout(timeoutId)
      signal.removeEventListener("abort", abort)
    }

    const complete = (): void => {
      cleanup()
      resolve()
    }

    const timeoutId = setTimeout(complete, delay)

    abort = (): void => {
      cleanup()
      reject(new Error("Dictionary request aborted"))
    }

    if (signal.aborted) {
      abort()

      return
    }

    signal.addEventListener("abort", abort, { once: true })
  })
}

/**
 * 兼容旧的两参数字典 API；显式声明第三参数时才传入 AbortSignal。
 */
function callDictionaryApi<TValues extends Values, TResponse>(
  values: TValues,
  form: SchemxInstance<TValues>,
  api: import("@schemx/core").SchemxDictionary<TValues, TResponse>["api"],
  signal: AbortSignal
): TResponse | Promise<TResponse> {
  if (api.length >= 3) {
    return api(values, form, signal)
  }

  return api(values, form)
}

export default useDictionary
