import { mergeConfig } from "./config"
import { createFormWithSnapshot } from "./createForm"
import { createPresetRuleRegistry, createRendererRegistry } from "./registry"

import type { CreateFormOptions, SchemxConfig } from "./config"
import type { PresetRuleRegistry, RendererRegistry } from "./registry"
import type { SchemxInstance, Values } from "./types"

/**
 * `createSchemx` 的工厂入参，与共享默认配置使用同一契约。
 *
 * @typeParam TValues - Schema 默认值和 Renderer 配置关联的表单值类型。
 */
export type CreateSchemxOptions<TValues extends Values = Values> = SchemxConfig<TValues>

/**
 * 替换业务覆盖层的配置；Registry 引用在工厂创建时固定。
 */
export type SchemxConfigureOptions = Omit<
  CreateSchemxOptions,
  "rendererRegistry" | "presetRuleRegistry"
> & {
  /**
   * Registry 通过注册方法修改，或在单个表单中覆盖。
   */
  rendererRegistry?: never
  /**
   * 工厂的预设规则注册表引用固定。
   */
  presetRuleRegistry?: never
}

/**
 * 独立的共享默认配置、Registry 与表单创建 API。
 */
export interface SchemxApi {
  /**
   * 创建表单并捕获当前默认配置，由调用方负责销毁。
   * @typeParam TValues - 本次调用的表单值类型。
   * @param options - 实例数据、局部配置与回调。
   * @example const form = api.createForm({ initialValues: { name: "" } })
   */
  createForm<TValues extends Values = Values>(
    this: void,
    options?: CreateFormOptions<TValues>
  ): SchemxInstance<TValues>
  /**
   * 替换业务覆盖层；省略时恢复创建基线，只影响后续创建。
   * @param options - 不包含 Registry 的共享默认配置。
   * @throws TypeError 输入包含任一 Registry 键。
   * @example api.configureSchemx({ debug: true })
   */
  configureSchemx(this: void, options?: SchemxConfigureOptions): void
  /**
   * 读取冻结的共享默认配置，不包含内置默认值或框架上下文。
   * @example const defaults = api.getConfig()
   */
  getConfig(this: void): Readonly<CreateSchemxOptions>
  /**
   * 工厂固定使用的 Renderer Registry。
   */
  readonly rendererRegistry: RendererRegistry
  /**
   * 工厂固定使用的预设规则 Registry。
   */
  readonly presetRuleRegistry: PresetRuleRegistry
}

/**
 * 创建不读取模块级全局配置的独立表单工厂。
 *
 * @param config - 创建基线；未传入 Registry 时分别新建注册表。
 * @returns 配置与创建方法组成的五项 API。
 * @example
 * const api = createSchemx({ debug: true, validationConcurrency: 2 })
 * const form = api.createForm({ initialValues: { name: "" } })
 * form.destroy()
 */
export function createSchemx(config: CreateSchemxOptions = {}): SchemxApi {
  const rendererRegistry =
    config.rendererRegistry ??
    createRendererRegistry(config.defaultRendererType ?? "input")

  const presetRuleRegistry = config.presetRuleRegistry ?? createPresetRuleRegistry()

  const baseline = mergeConfig({
    ...config,
    rendererRegistry,
    presetRuleRegistry,
  })

  let currentConfig = baseline

  const configureSchemx = (options?: SchemxConfigureOptions): void => {
    if (
      options !== undefined &&
      (Object.hasOwn(options, "rendererRegistry") ||
        Object.hasOwn(options, "presetRuleRegistry"))
    ) {
      throw new TypeError("[schemx] configureSchemx cannot replace factory Registries.")
    }

    currentConfig = options === undefined ? baseline : mergeConfig(options, baseline)
  }

  const createForm = <TValues extends Values = Values>(
    options: CreateFormOptions<TValues> = {}
  ): SchemxInstance<TValues> => {
    // 工厂不绑定业务值类型，创建边界关联本次调用的泛型。
    const defaults = currentConfig as CreateSchemxOptions<TValues>

    return createFormWithSnapshot(options, defaults)
  }

  // 读取当前冻结配置，不在返回对象中创建行为。
  const getConfig: SchemxApi["getConfig"] = () => currentConfig

  return {
    createForm,
    configureSchemx,
    getConfig,
    rendererRegistry,
    presetRuleRegistry,
  }
}
