import { omit } from "es-toolkit"

import { batchUpdates, createReactiveScope, createSignal } from "../reactivity"
import { createPresetRuleRegistry, createRendererRegistry } from "../registry"

import { mergeConfig, resolveSchemxConfig } from "./mergeSchemxConfig"

import type { SchemxConfigSnapshot } from "./mergeSchemxConfig"
import type { SchemxConfig } from "./types"
import type { ReadonlyState } from "../reactivity"
import type { PresetRuleRegistry, RendererRegistry } from "../registry"
import type { SchedulerOptions } from "../scheduler"
import type { SchemxSchemaConfig, Values } from "../types"
import type { ValidationAdapterOption } from "../validator"

// 子系统创建选项固定；运行期只替换消费配置，不重建 Registry、Validator 或 Scheduler。
const creationConfigKeys = [
  "rendererRegistry",
  "presetRuleRegistry",
  "validatorAdapters",
  "defaultRendererType",
  "debug",
  "schedulerOptions",
  "validationConcurrency",
] as const

/**
 * 创建时固定的引擎选项。
 */
type CreationConfigKey = (typeof creationConfigKeys)[number]

/**
 * 可以在运行期替换的消费配置，优先于固定的库默认值。
 *
 * @typeParam TValues - 当前表单值类型。
 */
export type FormConfig<TValues extends Values = Values> = Omit<
  SchemxConfig<TValues>,
  CreationConfigKey
> & {
  readonly [TKey in CreationConfigKey]?: never
}

/**
 * 消费配置与固定默认值合并后的冻结结果，Schema 默认值已由 Core 补齐。
 *
 * @typeParam TValues - 当前表单值类型。
 */
export interface ResolvedFormConfig<
  TValues extends Values = Values,
> extends SchemxConfigSnapshot<TValues> {
  /**
   * 字段显式配置之前的完整表单级默认值。
   */
  readonly schemaConfig: Readonly<SchemxSchemaConfig<TValues>>
  /**
   * 当前 Form 固定使用的 Renderer Registry。
   */
  readonly rendererRegistry: RendererRegistry
  /**
   * 当前 Form 固定使用的命名规则 Registry。
   */
  readonly presetRuleRegistry: PresetRuleRegistry
  /**
   * 创建 Validator 使用的完整 adapter 列表。
   */
  readonly validatorAdapters: readonly ValidationAdapterOption[]
  /**
   * 创建 Runtime 时固定的诊断开关。
   */
  readonly debug: boolean
  /**
   * 已补齐诊断开关的固定调度配置。
   */
  readonly schedulerOptions: Readonly<SchedulerOptions>
}

/**
 * 固定默认值与单份消费配置的模型；不维护来源列表、优先级队列或层的生命周期。
 *
 * @typeParam TValues - 当前表单值类型。
 */
export interface FormConfigModel<TValues extends Values> {
  /**
   * 创建时捕获的继承配置，不包含局部消费覆盖。
   */
  readonly inheritedConfig: SchemxConfigSnapshot<TValues>
  /**
   * 已提交给 Runtime 的生效配置。
   */
  readonly state: ReadonlyState<ResolvedFormConfig<TValues>>
  /**
   * 供 Runtime 初次装配读取同一结果，不建立依赖。
   */
  getConfig(this: void): ResolvedFormConfig<TValues>
  /**
   * 完整替换消费配置，缺省属性恢复固定默认值。
   * @param config - 最高优先级的消费配置。
   * @param apply - 本次更新在状态发布前执行的编译提交。
   */
  setConfig(
    this: void,
    config: FormConfig<TValues>,
    apply?: ApplyFormConfig<TValues>
  ): void
  /**
   * 局部更新消费配置中的 Schema 默认值，保留原有清除语义。
   * @param partial - 缺省保留，显式 undefined 恢复 Core 默认值的属性。
   * @param apply - 本次更新在状态发布前执行的编译提交。
   */
  updateSchemaConfig(
    this: void,
    partial: Partial<SchemxSchemaConfig<TValues>>,
    apply?: ApplyFormConfig<TValues>
  ): void
  /**
   * 停止配置订阅并禁止后续配置提交，由 Form 统一调用。
   */
  dispose(this: void): void
}

/**
 * 配置发布前同步应用编译结果。
 * @typeParam TValues - 当前表单值类型。
 * @param config - 本次完整生效配置。
 */
export type ApplyFormConfig<TValues extends Values> = (
  config: ResolvedFormConfig<TValues>
) => void

/**
 * 配置模型的继承默认值和初始消费输入。
 *
 * @typeParam TValues - 当前表单值类型。
 */
export interface CreateFormConfigOptions<TValues extends Values> {
  /**
   * Core、框架和 UI 提供的继承配置；在当前创建边界捕获。
   */
  readonly defaults?: SchemxConfig<TValues>
  /**
   * 初始局部配置，包含本次创建时选择的引擎选项。
   */
  readonly config?: SchemxConfig<TValues>
}

/**
 * 解析后固定的引擎能力，由配置模型统一选择。
 * @typeParam TValues - 当前表单值类型。
 */
type FormCreationConfig<TValues extends Values> = Pick<
  ResolvedFormConfig<TValues>,
  CreationConfigKey
>

/**
 * 创建单份消费配置模型，统一合并、默认值回退与生效通知。
 *
 * @typeParam TValues - 当前表单值类型。
 * @param options - 继承默认值与初始局部配置。
 * @returns 原生只读生效状态与消费配置更新操作。
 * @example
 * const config = createFormConfig({ defaults: uiDefaults, config: props })
 * config.setConfig({ schemaConfig: { disabled: true } })
 * config.setConfig({})
 * config.dispose()
 */
export function createFormConfig<TValues extends Values>(
  options: CreateFormConfigOptions<TValues> = {}
): FormConfigModel<TValues> {
  // 输入各捕获一次；后续解析只读取冻结快照，避免重复求值调用方的 getter。
  const inheritedConfig = mergeConfig(options.defaults ?? {})

  const captured = mergeConfig(options.config ?? {})

  const merged = mergeConfig(captured, inheritedConfig)

  const creation: FormCreationConfig<TValues> = Object.freeze({
    rendererRegistry:
      merged.rendererRegistry ?? createRendererRegistry(merged.defaultRendererType),
    presetRuleRegistry: merged.presetRuleRegistry ?? createPresetRuleRegistry(),
    validatorAdapters: merged.validatorAdapters ?? Object.freeze([]),
    debug: merged.debug ?? false,
    defaultRendererType: merged.defaultRendererType,
    schedulerOptions: Object.freeze({
      ...merged.schedulerOptions,
      collectDiagnostics:
        merged.schedulerOptions?.collectDiagnostics ?? merged.debug ?? false,
    }),
    validationConcurrency: merged.validationConcurrency,
  })

  // 引擎选项单独固定；运行期只合并消费配置，避免重复复制 adapter 和调度选项。
  const defaults = Object.freeze(omit(inheritedConfig, creationConfigKeys))

  let consumer = Object.freeze(omit(captured, creationConfigKeys))

  // 配置模型独立拥有订阅生命周期，由 Form 在其他子系统之后释放。
  const scope = createReactiveScope()

  const current = createSignal(resolveFormConfig(merged, creation))

  const state = scope.state(() => current.value)

  const getConfig = (): ResolvedFormConfig<TValues> => current.peek()

  /**
   * 先应用 Runtime，再与配置状态在同一 batch 内发布。
   * @param nextConsumer - 已捕获的消费输入。
   * @param submitted - 本次显式提交的属性，覆盖同引用对象内的修改。
   * @param apply - 本次更新的编译提交函数。
   */
  const commit = (
    nextConsumer: SchemxConfigSnapshot<TValues>,
    submitted: SchemxConfig<TValues>,
    apply?: ApplyFormConfig<TValues>
  ): void => {
    const next = resolveFormConfig(mergeConfig(nextConsumer, defaults), creation)

    const previous = current.peek()

    // 编译相关配置只比较一次；显式提交的对象仍需覆盖其内部原地修改。
    const runtimeChanged =
      !shallowEqual(previous.schemaConfig, next.schemaConfig) ||
      !shallowEqual(previous.rendererProps, next.rendererProps, (first, second) =>
        shallowEqual(first, second)
      ) ||
      hasSubmittedObjects(submitted.schemaConfig, next.schemaConfig) ||
      Object.entries(submitted.rendererProps ?? {}).some(([type, props]) =>
        hasSubmittedObjects(props, Reflect.get(next.rendererProps ?? {}, type))
      )

    const stateChanged =
      runtimeChanged ||
      hasSubmittedObjects(submitted, next) ||
      !shallowEqual(
        previous,
        next,
        (first, second, key) =>
          key === "schemaConfig" || key === "rendererProps" || Object.is(first, second)
      )

    if (!stateChanged) {
      consumer = nextConsumer

      return
    }

    batchUpdates(() => {
      if (runtimeChanged) {
        apply?.(next)
      }

      consumer = nextConsumer
      current.value = next
    })
  }

  /**
   * 替换消费输入，固定默认值始终不变。
   * @param config - 当前消费端的完整运行期配置。
   * @param apply - 本次更新在状态发布前执行的编译提交。
   */
  const setConfig: FormConfigModel<TValues>["setConfig"] = (config, apply) => {
    if (scope.disposed) {
      return
    }

    for (const key of creationConfigKeys) {
      if (Object.hasOwn(config, key)) {
        throw new TypeError(
          `[schemx] Form config cannot change creation option "${key}".`
        )
      }
    }

    const next = mergeConfig<TValues>(config)

    commit(next, next, apply)
  }

  /**
   * 保留旧局部更新行为，但不再直接修改 Runtime 配置。
   * @param partial - 需要更新的 Schema 默认属性。
   * @param apply - 本次更新在状态发布前执行的编译提交。
   */
  const updateSchemaConfig: FormConfigModel<TValues>["updateSchemaConfig"] = (
    partial,
    apply
  ) => {
    if (scope.disposed) {
      return
    }

    const patch = mergeConfig({ schemaConfig: partial })

    commit(mergeConfig(patch, consumer), patch, apply)
  }

  // 释放配置模型自身的订阅；已取得的状态仍可读取最后一次生效结果。
  const dispose = (): void => scope.dispose()

  return { inheritedConfig, state, getConfig, setConfig, updateSchemaConfig, dispose }
}

/**
 * 对合并快照补齐默认值，并仅冻结解析阶段新建的对象。
 * @typeParam TValues - 当前表单值类型。
 * @param config - 已捕获、合并并冻结受管层级的配置。
 * @param creation - 当前 Form 固定的引擎能力。
 */
function resolveFormConfig<TValues extends Values>(
  config: SchemxConfigSnapshot<TValues>,
  creation: FormCreationConfig<TValues>
): ResolvedFormConfig<TValues> {
  const resolved = resolveSchemxConfig(config)

  return Object.freeze({
    ...resolved,
    ...creation,
    schemaConfig: Object.freeze(resolved.schemaConfig),
  })
}

/**
 * 按属性比较值，允许受管对象忽略合并生成的容器引用。
 * @param previous - 旧属性值。
 * @param next - 新属性值。
 * @param key - 当前属性名。
 */
type ConfigValueComparator = (previous: unknown, next: unknown, key: string) => boolean

/**
 * 比较对象的一层属性；缺省对象视为空对象。
 * @param previous - 旧对象。
 * @param next - 新对象。
 * @param compare - 属性比较规则，默认保持身份语义。
 */
function shallowEqual(
  previous: unknown,
  next: unknown,
  compare: ConfigValueComparator = Object.is
): boolean {
  const first = previous ?? {}

  const second = next ?? {}

  if (typeof first !== "object" || typeof second !== "object") {
    return Object.is(first, second)
  }

  const keys = Object.keys(first)

  return (
    keys.length === Object.keys(second).length &&
    keys.every(
      (key) =>
        Object.hasOwn(second, key) &&
        compare(Reflect.get(first, key), Reflect.get(second, key), key)
    )
  )
}

/**
 * 检查本次显式提交的对象引用，使其内部原地修改仍能触发更新。
 * @param submitted - 已捕获的提交属性。
 * @param resolved - 本次生效属性；受管容器自身由合并过程新建。
 */
function hasSubmittedObjects(submitted: object | undefined, resolved: unknown): boolean {
  if (resolved === null || typeof resolved !== "object") {
    return false
  }

  return Object.entries(submitted ?? {}).some(
    ([key, value]) =>
      value !== null &&
      typeof value === "object" &&
      Object.is(Reflect.get(resolved, key), value)
  )
}
