import { createPresetRuleRegistry, createRendererRegistry } from "../registry"

import { mergeConfig } from "./mergeSchemxConfig"

import type { PresetRuleRegistry, RendererRegistry } from "../registry"
import type { SchemxConfigSnapshot } from "./mergeSchemxConfig"
import type { SchemxConfig } from "./types"

/**
 * 替换业务覆盖层的配置；Registry 引用在工厂创建时固定。
 */
export type SchemxConfigureOptions = Omit<
  SchemxConfig,
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
 * 工厂固定的 Registry 和可替换的共享配置快照。
 */
export interface FactoryConfig {
  /**
   * 工厂固定使用的 Renderer Registry。
   */
  readonly rendererRegistry: RendererRegistry
  /**
   * 工厂固定使用的命名规则 Registry。
   */
  readonly presetRuleRegistry: PresetRuleRegistry
  /**
   * 替换业务覆盖，省略时恢复基线。
   * @param options - 不包含 Registry 的共享配置。
   * @example configuration.configureSchemx({ debug: true })
   */
  configureSchemx(options?: SchemxConfigureOptions): void
  /**
   * 读取只影响后续表单的当前配置。
   * @example const defaults = configuration.getConfig()
   */
  getConfig(): SchemxConfigSnapshot
}

/**
 * 捕获工厂基线并管理业务覆盖；不创建表单状态或运行资源。
 * @param input - 工厂初始的共享配置。
 * @returns 固定 Registry、配置替换和快照读取入口。
 * @example const configuration = createFactoryConfig({ debug: true })
 */
export function createFactoryConfig(input: SchemxConfig): FactoryConfig {
  // 原始顶层 getter 只在此边界读取一次。
  const config = { ...input }

  // 工厂注册表在创建后保持同一引用。
  const rendererRegistry =
    config.rendererRegistry ??
    createRendererRegistry(config.defaultRendererType ?? "input")

  // 命名规则由同一工厂创建的表单共享。
  const presetRuleRegistry = config.presetRuleRegistry ?? createPresetRuleRegistry()

  // 不包含 Core 默认值的工厂创建基线。
  const baseline = mergeConfig({
    ...config,
    rendererRegistry,
    presetRuleRegistry,
  })

  // 本次覆盖与固定基线合并后的快照。
  let currentConfig = baseline

  /**
   * 替换覆盖配置并禁止改变固定 Registry。
   * @param options - 本次完整业务覆盖，省略时恢复基线。
   */
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

  // 返回配置模块拥有的冻结快照。
  const getConfig = (): SchemxConfigSnapshot => currentConfig

  return { rendererRegistry, presetRuleRegistry, configureSchemx, getConfig }
}
