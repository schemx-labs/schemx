/**
 * useDictionary - 字典选项 Hook
 *
 * 通过 api 函数加载字典选项，支持完整的表单值泛型推导。
 * 自动在组件挂载时加载，支持通过 dependsOn 声明依赖字段，
 * 当依赖字段变化时自动重新请求。
 *
 * @module hooks/useDictionary
 */

import { onMounted, onScopeDispose, Ref, ref, shallowRef } from "vue"

import type { SchemxDictionary } from "@/types/dictionary"

import { useFormContext } from "../context/formContext"

import { useWatchFields } from "./useWatch"

import type { NamePath, SchemxInstance, Values } from "@schemx/core"

export type { SchemxDictionary, SchemxWithDictionary } from "@/types/dictionary"

/**
 * useDictionary 返回值。
 *
 * @typeParam TOption - 格式化后的字典选项类型。
 */
export interface UseDictionaryReturn<TOption = unknown> {
  /**
   * 远程加载的字典选项列表（响应式）
   */
  list: Ref<TOption[]>
  /**
   * 请求加载状态（响应式）
   */
  loading: Ref<boolean>
  /**
   * 请求错误信息（响应式）
   */
  error: Ref<Error | undefined>
  /**
   * 触发字典选项加载
   */
  loadDict: () => Promise<void>
  /**
   * 使用当前配置重新执行 api
   */
  refresh: () => Promise<void>
  /**
   * 直接修改 list 的值，不触发 api 调用
   */
  mutate: (data: TOption[]) => void
}

/**
 * useDictionary 返回值的旧类型别名。
 *
 * @deprecated 请使用 `UseDictionaryReturn`。
 * @typeParam TOption - 格式化后的字典选项类型。
 */
export type UseDictOptionsReturn<TOption = unknown> = UseDictionaryReturn<TOption>

/**
 * 将未知抛出值规范化为 `Error` 实例
 *
 * @param err - 捕获的值（可能是任意类型）
 * @returns 包装原始值的 `Error` 对象
 *
 * @example
 * ```ts
 * const error = normalizeError("request failed")
 * ```
 */
export function normalizeError(err: unknown): Error {
  if (err instanceof Error) return err

  return new Error(String(err))
}

/**
 * 加载字典选项
 *
 * 通过 api 函数获取数据，支持完整的表单值泛型推导。
 * 自动在组件挂载时加载，支持依赖字段联动、竞态控制、
 * 重试、错误处理等能力。
 *
 * @typeParam TValues - 表单值类型
 * @typeParam TName - 当前字段路径类型
 * @typeParam TResponse - api 的原始返回值类型
 * @typeParam TOption - 格式化后的字典选项类型
 * @param options - 字典配置选项
 * @param fieldName - 当前字段名，用于 resetOnDepsChange 时清空字段值
 * @returns `{ list, loading, error, loadDict, refresh, mutate }`：响应式选项、
 * 加载与错误状态，以及加载、刷新和本地更新方法
 *
 * @example
 * ```ts
 * // 基础用法
 * const { list, loading, error, loadDict, refresh, mutate } = useDictionary({
 *   api: async () => {
 *     const res = await fetch('/api/options')
 *     return res.json()
 *   },
 * })
 *
 * await loadDict() // 主动加载
 * await refresh()  // 使用当前配置重新加载
 * mutate([{ label: "手动选项", value: "manual" }])
 * console.log(list.value, loading.value, error.value)
 *
 * // 依赖联动（带泛型）
 * const { list } = useDictionary<MyFormValues>({
 *   api: async (values) => fetchCities(values.province),
 *   dependsOn: ['province'],
 *   shouldFetch: (values) => !!values.province,
 *   resetOnDepsChange: true,
 *   immediate: false,
 * }, 'city')
 * ```
 */
export const useDictionary = <
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
  TResponse = unknown,
  TOption = unknown,
>(
  options: SchemxDictionary<TValues, TResponse, TOption>,
  fieldName?: TName
): UseDictionaryReturn<TOption> => {
  const instance = useFormContext<TValues>()

  const list = shallowRef<TOption[]>([])

  const loading = ref<boolean>(false)

  const error = ref<Error | undefined>(undefined)

  // 竞态控制：仅最新请求写入状态
  let requestCount = 0

  let activeController: AbortController | null = null

  /**
   * 使用配置的 formatter 格式化原始响应数据
   *
   * @param res - api 返回的原始数据。
   * @returns 可供 Renderer 使用的选项列表。
   */
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

  /**
   * 带重试的执行
   *
   * @param formValues - 当前表单值快照。
   * @param signal - 用于中止当前请求或重试等待的信号。
   * @returns api 返回的原始数据。
   */
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

  /**
   * 执行 api 函数加载字典选项
   *
   * 只有最后一次请求可以写入响应式状态；组件卸载或新请求开始时，旧请求会被忽略。
   */
  const loadDict = async (): Promise<void> => {
    const currentCount = ++requestCount

    activeController?.abort()

    const controller = new AbortController()

    activeController = controller

    try {
      const formValues = instance.getFieldsSnapshot()

      // shouldFetch 检查
      if (typeof options.shouldFetch === "function" && !options.shouldFetch(formValues)) {
        list.value = []
        loading.value = false

        return
      }

      loading.value = true
      error.value = undefined

      const res = await executeWithRetry(formValues, controller.signal)

      // 竞态检查：丢弃过期响应
      if (currentCount !== requestCount || controller.signal.aborted) return

      const formatted = await format(res)

      // 格式化后再次竞态检查（格式化可能是异步的）
      if (currentCount !== requestCount || controller.signal.aborted) return

      list.value = formatted
      error.value = undefined

      // onSuccess 回调
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

  // 使用当前配置重新执行一次字典请求。
  const refresh = (): Promise<void> => loadDict()

  // 直接替换当前选项列表，不触发远程请求。
  const mutate = (data: TOption[]): void => {
    list.value = data
  }

  // ========== 依赖字段监听 ==========
  if (options.dependsOn?.length) {
    useWatchFields(
      options.dependsOn,
      (latestSnapshot, _payload) => {
        // 1. 触发 onDepsChange 回调
        if (typeof options.onDepsChange === "function") {
          options.onDepsChange(latestSnapshot as TValues, instance)
        }

        // 2. 清空当前字段值
        if (options.resetOnDepsChange && fieldName) {
          instance.setFieldValue(fieldName, undefined)
        }

        // 3. 重新执行 api
        void loadDict()
      },
      { inequality: true }
    )
  }

  // ========== 挂载行为 ==========
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
 *
 * @param delay - 等待时长，单位为毫秒。
 * @param signal - 中止等待的 AbortSignal。
 * @returns 等待完成后 resolve；中止时 reject。
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
 *
 * @param values - 当前表单值快照。
 * @param form - 当前表单实例。
 * @param api - 字典数据获取函数。
 * @param signal - 当前请求的 AbortSignal。
 * @returns api 的同步或异步返回值。
 */
function callDictionaryApi<TValues extends Values, TResponse>(
  values: TValues,
  form: SchemxInstance<TValues>,
  api: SchemxDictionary<TValues, TResponse>["api"],
  signal: AbortSignal
): TResponse | Promise<TResponse> {
  if (api.length >= 3) {
    return api(values, form, signal)
  }

  return api(values, form)
}

export default useDictionary
