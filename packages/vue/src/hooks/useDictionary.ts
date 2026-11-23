/**
 * useDictionary - 字典选项 Hook
 *
 * 通过 api 函数加载字典选项，支持完整的表单值泛型推导。
 * 自动在组件挂载时加载，支持通过 dependsOn 声明依赖字段，
 * 当依赖字段变化时自动重新请求。
 *
 * @module hooks/useDictionary
 */

import { onMounted, Ref, ref } from "vue"

import { useFormInstance } from "./useForm"
import { useWatchFields } from "./useWatch"

import type { NamePath, SchemxDictionary, Values } from "@schemx/core"

export type { SchemxDictionary, SchemxWithDictionary } from "@schemx/core"

/**
 * useDictionary 返回值
 */
export interface UseDictOptionsReturn {
  /** 远程加载的字典选项列表（响应式） */
  list: Ref<any[]>
  /** 请求加载状态（响应式） */
  loading: Ref<boolean>
  /** 请求错误信息（响应式） */
  error: Ref<Error | undefined>
  /** 触发字典选项加载 */
  loadDict: () => Promise<void>
  /** 使用当前配置重新执行 api */
  refresh: () => Promise<void>
  /** 直接修改 list 的值，不触发 api 调用 */
  mutate: (data: any[]) => void
}

/**
 * 将未知抛出值规范化为 `Error` 实例
 *
 * @param err - 捕获的值（可能是任意类型）
 * @returns 包装原始值的 `Error` 对象
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
 * @param options - 字典配置选项
 * @param fieldName - 当前字段名，用于 resetOnDepsChange 时清空字段值
 * @returns 响应式选项列表、loading/error 状态及控制方法
 *
 * @example
 * ```ts
 * // 基础用法
 * const { list } = useDictionary({
 *   api: async () => {
 *     const res = await fetch('/api/options')
 *     return res.json()
 *   },
 * })
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
>(
  options: SchemxDictionary<TValues>,
  fieldName?: TName
): UseDictOptionsReturn => {
  const instance = useFormInstance<TValues>()

  const list = ref<any[]>([])
  const loading = ref<boolean>(false)
  const error = ref<Error | undefined>(undefined)

  // 竞态控制：仅最新请求写入状态
  let requestCount = 0

  /**
   * 使用配置的 formatter 格式化原始响应数据
   */
  const format = async (res: any): Promise<any> => {
    if (typeof options?.formatter === "function") {
      return await options.formatter(res, instance)
    }

    return res
  }

  /**
   * 带重试的执行
   */
  const executeWithRetry = async (formValues: TValues): Promise<any> => {
    const maxRetries = options.retryCount ?? 0
    const retryDelay = options.retryInterval ?? 1000
    let lastError: Error = new Error("Unknown error")

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await options.api(formValues, instance)
      } catch (err) {
        lastError = normalizeError(err)

        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, retryDelay))
        }
      }
    }

    throw lastError
  }

  /**
   * 执行 api 函数加载字典选项
   */
  const loadDict = async (): Promise<void> => {
    try {
      const formValues = instance.getFieldsValue()

      // shouldFetch 检查
      if (typeof options.shouldFetch === "function" && !options.shouldFetch(formValues)) {
        list.value = []
        loading.value = false

        return
      }

      loading.value = true
      error.value = undefined

      // 递增请求计数器用于竞态控制
      const currentCount = ++requestCount

      const res = await executeWithRetry(formValues)

      // 竞态检查：丢弃过期响应
      if (currentCount !== requestCount) return

      const formatted = await format(res)

      // 格式化后再次竞态检查（格式化可能是异步的）
      if (currentCount !== requestCount) return

      list.value = formatted
      error.value = undefined

      // onSuccess 回调
      if (typeof options.onSuccess === "function") {
        options.onSuccess(formatted, instance)
      }

      loading.value = false
    } catch (err) {
      const normalized = normalizeError(err)

      error.value = normalized
      list.value = []
      loading.value = false

      if (typeof options.onError === "function") {
        options.onError(normalized, instance)
      }
    }
  }

  const refresh = (): Promise<void> => loadDict()

  const mutate = (data: any[]): void => {
    list.value = data
  }

  // ========== 依赖字段监听 ==========
  if (options.dependsOn?.length) {
    useWatchFields(options.dependsOn, (_payload, latestSnapshot) => {
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
    })
  }

  // ========== 挂载行为 ==========
  const immediate = options.immediate ?? true

  onMounted(() => {
    if (immediate) {
      void loadDict()
    }
  })

  return { list, loading, error, loadDict, refresh, mutate }
}

export default useDictionary
