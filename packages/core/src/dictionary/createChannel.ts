/**
 * 字段字典 Channel。
 *
 * 每个参与字典的字段持有一个 channel：保存当前选项与请求状态，刷新成功后整体覆盖本地修改。
 * 请求直接消费 `SchemxDictionary` 配置（`api` / `formatter` / 重试 / 回调），
 * 使用序号 + AbortController 控制竞态，未完成的刷新默认合并。
 *
 * @module core/dictionary/createChannel
 */

import { batchUpdates, createSignal, runSignalUntracked } from "../reactivity"

import { resolveDictionaryTarget } from "./target"

import type { Scope } from "../node"
import type { Scheduler } from "../scheduler"
import type { NamePath, SchemxInstance, Values } from "../types"
import type {
  DictionaryKeyMap,
  FieldDictionaryChannel,
  FieldDictionaryOptionsAction,
  FieldDictionaryResult,
  FieldDictionarySnapshot,
  FieldDictionaryStatus,
  SchemxDictionary,
} from "./types"

/**
 * Channel 装配参数。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface FieldDictionaryChannelOptions<TValues extends Values = Values> {
  /** 节点作用域，channel 释放时同步中止请求与依赖监听。 */
  scope: Scope
  /**
   * 将请求纳入 Core 的异步完成边界，不阻塞其他字段请求。
   */
  scheduler?: Scheduler
  /** 读取字段当前路径（改名后自动跟随）。 */
  getName: () => NamePath<TValues>
  /** 本通道的固定配置；替换配置时装配新通道。 */
  config: SchemxDictionary<TValues>
  /** 读取表单实例，用于依赖监听、回调与清值。 */
  getForm: () => SchemxInstance<TValues>
}

/**
 * 请求策略；依赖变化时中止在途请求并重新加载。
 */
interface DictionaryRequestOptions {
  /**
   * 是否中止旧请求。
   */
  force?: boolean
}

/**
 * 默认重试间隔（毫秒）。
 */
const DEFAULT_RETRY_INTERVAL = 1000

/**
 * 把未知抛出值规范化为 Error。
 *
 * @param error - 捕获值。
 * @returns Error 实例。
 */
function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

/**
 * 可响应中止的重试等待。
 *
 * @param delay - 等待毫秒数。
 * @param signal - 当前请求信号。
 * @returns 等待结束或被中止。
 */
function waitForRetry(delay: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort)
      resolve()
    }, delay)

    const onAbort = (): void => {
      clearTimeout(timer)
      reject(new Error("Dictionary request aborted"))
    }

    if (signal.aborted) {
      onAbort()

      return
    }

    signal.addEventListener("abort", onAbort, { once: true })
  })
}

/**
 * 判断映射是否包含任何有效键。
 *
 * @param keyMap - 字段字典配置的字段映射。
 * @returns 是否至少声明了一个字段。
 */
function hasKeyMap(keyMap: DictionaryKeyMap): boolean {
  return Boolean(
    keyMap.labelKey || keyMap.valueKey || keyMap.childrenKey || keyMap.disabledKey
  )
}

/**
 * 按字段映射补出统一的 `label` / `value` / `children` / `disabled`。
 *
 * 原字段保留；只映射显式声明的键，且 `childrenKey` 声明时递归处理子节点。
 *
 * @param list - `api` 直接返回的原始选项。
 * @param keyMap - 字段映射。
 * @returns 补齐标准字段的选项。
 */
function normalizeOptions(list: readonly unknown[], keyMap: DictionaryKeyMap): unknown[] {
  return list.map((item) => {
    if (item === null || typeof item !== "object") {
      return item
    }

    const record = item as Record<string, unknown>

    const next: Record<string, unknown> = { ...record }

    if (keyMap.labelKey) {
      next.label = record[keyMap.labelKey]
    }

    if (keyMap.valueKey) {
      next.value = record[keyMap.valueKey]
    }

    if (keyMap.disabledKey) {
      next.disabled = record[keyMap.disabledKey]
    }

    if (keyMap.childrenKey) {
      const children = record[keyMap.childrenKey]

      if (Array.isArray(children)) {
        next.children = normalizeOptions(children, keyMap)
      }
    }

    return next
  })
}

/**
 * 按配置把响应规范化为选项数组。
 *
 * @param config - 字典配置。
 * @param response - `api` 的返回值。
 * @param form - 当前表单实例。
 * @param keyMap - 字段字典声明的映射；仅在没有 `formatter` 时生效。
 * @returns 选项数组。
 */
async function formatResponse<TValues extends Values>(
  config: SchemxDictionary<TValues>,
  response: unknown,
  form: SchemxInstance<TValues>,
  keyMap: DictionaryKeyMap | undefined
): Promise<unknown[]> {
  if (typeof config.formatter === "function") {
    // formatter 结果由消费端提供，校验 JS 或动态配置输入。
    const formatted = await config.formatter(response, form)

    if (!Array.isArray(formatted)) {
      throw new Error("[schemx] Dictionary formatter must return an array.")
    }

    return formatted
  }

  if (!Array.isArray(response)) {
    throw new Error(
      "[schemx] Dictionary api must return an array when formatter is not provided."
    )
  }

  return keyMap && hasKeyMap(keyMap) ? normalizeOptions(response, keyMap) : response
}

/**
 * 创建字段字典 Channel。
 *
 * @typeParam TValues - 表单值类型。
 * @param options - 路径、取值、配置读取与生命周期参数。
 * @returns 当前字段的字典运行态。
 * @example createFieldDictionaryChannel({ scope, getName, config, getForm })
 */
export function createFieldDictionaryChannel<TValues extends Values = Values>(
  options: FieldDictionaryChannelOptions<TValues>
): FieldDictionaryChannel {
  // 当前生效的选项；远端结果与本地修改共用此列表。
  const optionsSignal = createSignal<readonly unknown[]>([])

  // 请求加载标记。
  const loading = createSignal(false)

  // 最近一次请求错误。
  const error = createSignal<Error | undefined>(undefined)

  // 当前请求状态。
  const status = createSignal<FieldDictionaryStatus>("idle")

  // 成功请求的版本号，本地操作不递增。
  const version = createSignal(0)

  // 最新请求或取消操作的序号。
  let seq = 0

  // pending 对应的请求序号，防止旧请求清理新请求。
  let pendingSeq = 0

  // 当前可复用的请求 Promise。
  let pending: Promise<FieldDictionaryResult> | null = null

  // 当前请求从调度器等待边界退出的句柄。
  let releasePending: (() => void) | undefined

  // 当前请求的中止控制器。
  let controller: AbortController | null = null

  // 依赖字段监听的清理函数。
  let dependencyDispose: (() => void) | null = null

  /**
   * 读取当前选项，不订阅其他请求状态。
   */
  const readOptions = (): readonly unknown[] => optionsSignal.value

  /**
   * 读取加载标记，不使 ViewSchema 订阅错误或版本变化。
   */
  const isLoading = (): boolean => loading.value

  /**
   * 读取当前选项与请求状态。
   */
  const snapshot = (): FieldDictionarySnapshot => ({
    options: optionsSignal.value,
    status: status.value,
    loading: loading.value,
    error: error.value,
    version: version.value,
  })

  /**
   * 返回当前选项与成功请求版本。
   */
  const success = (): FieldDictionaryResult => ({
    ok: true,
    options: optionsSignal.value,
    version: version.value,
  })

  /**
   * 带重试地执行 `api`。
   *
   * @param config - 字典配置。
   * @param values - 本次表单值快照。
   * @param form - 当前表单实例。
   * @param signal - 当前请求信号。
   * @returns `api` 的返回值。
   */
  const execute = async (
    config: SchemxDictionary<TValues>,
    values: TValues,
    form: SchemxInstance<TValues>,
    signal: AbortSignal
  ): Promise<unknown> => {
    const maxRetries = config.retryCount ?? 0

    const interval = config.retryInterval ?? DEFAULT_RETRY_INTERVAL

    let lastError: Error = new Error("Dictionary request failed")

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (signal.aborted) {
        throw lastError
      }

      try {
        return await config.api(values, form, signal)
      } catch (caught) {
        lastError = toError(caught)

        if (attempt < maxRetries && !signal.aborted) {
          await waitForRetry(interval, signal)
        }
      }
    }

    throw lastError
  }

  /**
   * 执行一次请求；只有最新序号可以写状态。
   * @param config - 当前字典配置。
   * @param requestSeq - 本次请求序号。
   * @param requestController - 本次请求的中止控制器。
   */
  const run = async (
    config: SchemxDictionary<TValues>,
    requestSeq: number,
    requestController: AbortController
  ): Promise<FieldDictionaryResult> => {
    // 本次请求提供给字典回调的表单实例。
    const form = options.getForm()

    // 本次请求使用的表单值。
    const values = form.getFieldsSnapshot()

    // 请求取消、被替代或资源释放后禁止写入。
    const stale = (): boolean =>
      requestSeq !== seq || requestController.signal.aborted || options.scope.disposed

    try {
      // shouldFetch 和响应式观察者都可能同步替换或关闭字典。
      const shouldFetch = config.shouldFetch?.(values) ?? true

      if (stale()) {
        return { ok: false, reason: "aborted" }
      }

      if (!shouldFetch) {
        batchUpdates(() => {
          optionsSignal.value = []
          error.value = undefined
          status.value = "success"
          loading.value = false
        })

        return success()
      }

      batchUpdates(() => {
        loading.value = true
        status.value = "loading"
        error.value = undefined
      })

      if (stale()) {
        return { ok: false, reason: "aborted" }
      }

      // 远端 API 的原始响应。
      const response = await execute(config, values, form, requestController.signal)

      // 按 formatter 或字段映射得到的远端选项。
      if (stale()) {
        return { ok: false, reason: "aborted" }
      }

      const formatted = await formatResponse(config, response, form, config.keys)

      if (stale()) {
        return { ok: false, reason: "aborted" }
      }

      batchUpdates(() => {
        optionsSignal.value = formatted
        version.value += 1
        loading.value = false
        status.value = "success"
      })

      if (stale()) {
        return { ok: false, reason: "aborted" }
      }

      config.onSuccess?.(formatted, form)

      return success()
    } catch (caught) {
      if (stale()) {
        return { ok: false, reason: "aborted" }
      }

      // 统一为可以对外读取的 Error。
      const normalized = toError(caught)

      batchUpdates(() => {
        error.value = normalized
        optionsSignal.value = []
        loading.value = false
        status.value = "failed"
      })

      if (!stale()) {
        config.onError?.(normalized, form)
      }

      return { ok: false, reason: "failed", error: normalized }
    } finally {
      if (controller === requestController) {
        controller = null
      }
    }
  }

  /**
   * 首次解析到配置时建立依赖监听。
   *
   * @param config - 当前字典配置。
   */
  const ensureDependencyWatch = (config: SchemxDictionary<TValues>): void => {
    if (dependencyDispose || !config.dependsOn?.length) {
      return
    }

    const form = options.getForm()

    let previous: readonly unknown[] | undefined

    // 只订阅显式声明的依赖路径，首次执行仅记录基线。
    const dispose = form.effect(() => {
      // 本轮依赖字段值。
      const next = config.dependsOn?.map((path) => form.getFieldValue(path)) ?? []

      if (!previous) {
        previous = next

        return
      }

      // 只有显式依赖值变化才刷新。
      const changed =
        previous.length !== next.length ||
        previous.some((value, index) => !Object.is(value, next[index]))

      if (!changed) {
        return
      }

      previous = next

      // 回调和请求读取的值不加入此监听的依赖。
      runSignalUntracked(() => {
        config.onDepsChange?.(form.getFieldsSnapshot(), form)

        if (config.resetOnDepsChange) {
          form.setFieldValue(options.getName(), undefined)
        }

        void request({ force: true })
      })
    })

    dependencyDispose = dispose
    options.scope.add(dispose)
  }

  /**
   * 触发请求。
   *
   * @param config - `force` 时中止在途请求。
   */
  const request = (
    config: DictionaryRequestOptions = {}
  ): Promise<FieldDictionaryResult> => {
    // 销毁判断必须先于配置读取：表单销毁后不应再产生请求。
    if (options.scope.disposed) {
      return Promise.resolve({ ok: false, reason: "disposed" })
    }

    ensureDependencyWatch(options.config)

    if (pending && !config.force) {
      return pending
    }

    if (config.force) {
      releasePending?.()
      controller?.abort()
    }

    // 本次请求身份，供响应写入和 pending 清理时核对。
    const requestSeq = ++seq

    // 本次请求独立的中止控制器。
    const requestController = new AbortController()

    controller = requestController
    pendingSeq = requestSeq
    // 先发布 Promise，再调用用户回调，重入加载能复用同一个请求。
    let startRequest = (): void => {}

    const result = new Promise<FieldDictionaryResult>((resolve, reject) => {
      startRequest = () => {
        void run(options.config, requestSeq, requestController).then(resolve, reject)
      }
    }).finally(() => {
      if (pendingSeq === requestSeq) {
        pending = null
        releasePending = undefined
      }
    })

    pending = result
    releasePending = options.scheduler?.trackCancellable(result).cancel
    startRequest()

    return result
  }

  /**
   * 复用在途请求或成功选项，否则发起加载。
   */
  const load = (): Promise<FieldDictionaryResult> => {
    if (options.scope.disposed) {
      return Promise.resolve({ ok: false, reason: "disposed" })
    }

    if (pending) {
      return pending
    }

    if (status.peek() === "success") {
      return Promise.resolve(success())
    }

    return request()
  }

  /**
   * 刷新远端结果，默认合并在途请求。
   */
  const refresh = (): Promise<FieldDictionaryResult> => request()

  /**
   * 中止请求并保留当前选项，令过期响应失效。
   */
  const cancel = (): void => {
    seq += 1
    releasePending?.()
    releasePending = undefined
    controller?.abort()
    controller = null
    pending = null
    batchUpdates(() => {
      loading.value = false
      status.value =
        version.peek() > 0 || optionsSignal.peek().length > 0 ? "success" : "idle"
    })
  }

  /**
   * 写入当前选项，不改变在途请求；成功响应仍可覆盖本地修改。
   * @param action - 新列表或以当前只读列表为输入的 updater。
   */
  const setOptions = (action: FieldDictionaryOptionsAction): void => {
    // 先计算下一列表；updater 抛错时保留当前状态。
    const next = typeof action === "function" ? action(optionsSignal.peek()) : action

    batchUpdates(() => {
      optionsSignal.value = next
      error.value = undefined

      if (!loading.peek()) {
        status.value = "success"
      }
    })
  }

  /**
   * 释放依赖监听，并使当前请求失效。
   */
  const dispose = options.scope.dispose

  // 每个配置版本只自动加载一次。
  let started = false

  /**
   * 在 post 阶段启动配置的监听与首次请求。
   */
  const start = (): void => {
    if (started || options.scope.disposed) {
      return
    }

    started = true
    ensureDependencyWatch(options.config)

    if (options.config.immediate !== false) {
      void load()
    }
  }

  // 父节点释放子作用域时同样取消在途请求。
  options.scope.add(() => {
    seq += 1
    releasePending?.()
    releasePending = undefined
    controller?.abort()
    controller = null
    pending = null
  })

  // 装配节点持有的字典接口；所有行为在返回对象前定义。
  const channel: FieldDictionaryChannel = {
    start,
    targetKey: resolveDictionaryTarget(options.config.targetKey),
    options: readOptions,
    isLoading,
    snapshot,
    load,
    refresh,
    cancel,
    setOptions,
    dispose,
  }

  return channel
}
